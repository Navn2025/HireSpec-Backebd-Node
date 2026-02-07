import axios from 'axios';

class AIDetector
{
    constructor()
    {
        this.apiKey=process.env.GROQ_API_KEY;
        this.apiUrl='https://api.groq.com/openai/v1/chat/completions';
        this.model='llama-3.3-70b-versatile';
    }

    async detectAIGenerated(code, language, behaviorMetrics={})
    {
        const heuristicResult=this.heuristicAnalysis(code, language);
        const behaviorResult=this.analyzeBehavior(behaviorMetrics);
        let aiAnalysisResult=null;
        try {aiAnalysisResult=await this.groqDetection(code, language);}
        catch (err) {console.warn('Groq AI detection failed, using heuristics only:', err.message);}

        let finalScore;
        if (aiAnalysisResult)
        {
            finalScore=Math.round(heuristicResult.score*0.30+behaviorResult.score*0.35+aiAnalysisResult.score*0.35);
        } else
        {
            finalScore=Math.round(heuristicResult.score*0.45+behaviorResult.score*0.55);
        }
        const verdict=this.getVerdict(finalScore);

        // Build breakdown for frontend display
        const breakdown={
            'Heuristic': heuristicResult.score,
            'Behavior': behaviorResult.score,
        };
        if (aiAnalysisResult) breakdown['AI Analysis']=aiAnalysisResult.score;

        // Combine all signals for frontend display
        const allSignals=[
            ...heuristicResult.signals.map(s => s.signal? `${s.signal}: ${s.detail}`:(typeof s==='string'? s:JSON.stringify(s))),
            ...behaviorResult.signals.map(s => s.signal? `${s.signal}: ${s.detail}`:(typeof s==='string'? s:JSON.stringify(s))),
            ...(aiAnalysisResult?.signals||[])
        ];

        return {
            finalScore, verdict: verdict.label, confidence: verdict.confidence, color: verdict.color,
            breakdown,
            signals: allSignals,
            details: {
                heuristic: {score: heuristicResult.score, signals: heuristicResult.signals},
                behavior: {score: behaviorResult.score, signals: behaviorResult.signals},
                aiAnalysis: aiAnalysisResult? {score: aiAnalysisResult.score, reasoning: aiAnalysisResult.reasoning}:null
            },
            suggestions: this.getSuggestions(finalScore, heuristicResult, behaviorResult, aiAnalysisResult)
        };
    }

    heuristicAnalysis(code, language)
    {
        const signals=[];
        let score=0;
        const lines=code.split('\n');
        const nonEmptyLines=lines.filter(l => l.trim().length>0);

        const commentPatterns=language==='python'? [/^\s*#/, /^\s*"""/, /^\s*'''/]:[/^\s*\/\//, /^\s*\/\*/, /^\s*\*/];
        const commentLines=lines.filter(l => commentPatterns.some(p => p.test(l))).length;
        const commentRatio=commentLines/Math.max(nonEmptyLines.length, 1);
        if (commentRatio>0.35) {score+=15; signals.push({signal: 'High comment density', detail: `${Math.round(commentRatio*100)}% of lines are comments`, weight: 15});}

        if (language==='python')
        {
            const funcCount=(code.match(/def\s+\w+/g)||[]).length;
            const docstringCount=(code.match(/def\s+\w+[^:]+:\s*\n\s+(?:"""|\'\'\').*?(?:"""|\'\'\')*/gs)||[]).length;
            if (funcCount>0&&docstringCount>=funcCount) {score+=12; signals.push({signal: 'Every function has docstring', detail: `${docstringCount}/${funcCount} functions documented`, weight: 12});}
        }

        const varPatterns=language==='python'? code.match(/\b[a-z]+(?:_[a-z]+){3,}\b/g):code.match(/\b[a-z]+(?:[A-Z][a-z]+){3,}\b/g);
        if (varPatterns&&varPatterns.length>=3) {score+=10; signals.push({signal: 'Overly descriptive naming', detail: `Found ${varPatterns.length} very long variable names`, weight: 10});}

        const tryCatchCount=language==='python'? (code.match(/\btry\s*:/g)||[]).length:(code.match(/\btry\s*\{/g)||[]).length;
        if (tryCatchCount>=2&&nonEmptyLines.length<40) {score+=10; signals.push({signal: 'Excessive error handling', detail: `${tryCatchCount} try blocks in ${nonEmptyLines.length} lines`, weight: 10});}

        if (language==='python')
        {
            const typeHintFuncs=(code.match(/def\s+\w+\([^)]*:\s*\w+/g)||[]).length;
            const returnHints=(code.match(/->\s*\w+/g)||[]).length;
            if (typeHintFuncs>=2&&returnHints>=2) {score+=8; signals.push({signal: 'Comprehensive type hints', detail: `${typeHintFuncs} param hints, ${returnHints} return hints`, weight: 8});}
        }

        const indentSizes=nonEmptyLines.map(l => l.match(/^(\s*)/)[1].length).filter(s => s>0);
        if (indentSizes.length>5)
        {
            const indentUnit=language==='python'? 4:2;
            const perfectIndents=indentSizes.filter(s => s%indentUnit===0).length;
            if (perfectIndents/indentSizes.length===1.0&&indentSizes.length>10) {score+=5; signals.push({signal: 'Perfect indentation', detail: '100% consistent indentation throughout', weight: 5});}
        }

        const aiPhrases=[/# (?:initialize|define|create|set up|handle|process|validate|check|ensure|iterate|calculate)/i, /\/\/ (?:initialize|define|create|set up|handle|process|validate|check|ensure|iterate|calculate)/i, /# (?:this|we|the) (?:function|method|class|code|solution)/i, /# (?:base case|edge case|corner case|time complexity|space complexity)/i, /# O\(\w+\)/i];
        const aiPhraseMatches=lines.filter(l => aiPhrases.some(p => p.test(l))).length;
        if (aiPhraseMatches>=3) {score+=15; signals.push({signal: 'AI-style comments detected', detail: `${aiPhraseMatches} lines with typical AI comment patterns`, weight: 15});}

        if (language==='python')
        {
            const hasMainGuard=/if\s+__name__\s*==\s*['"]__main__['"]/.test(code);
            const hasHelper=(code.match(/def\s+_?\w+/g)||[]).length>=3;
            if (hasMainGuard&&hasHelper&&nonEmptyLines.length<50) {score+=8; signals.push({signal: 'Template structure', detail: 'Multiple helpers + main guard in short code', weight: 8});}
        }

        if (nonEmptyLines.length>20&&nonEmptyLines.length<60)
        {
            const uniqueWords=new Set(code.match(/\b[a-zA-Z_]\w+\b/g)||[]);
            if (uniqueWords.size>30) {score+=5; signals.push({signal: 'High vocabulary diversity', detail: `${uniqueWords.size} unique identifiers`, weight: 5});}
        }

        return {score: Math.min(score, 100), signals};
    }

    analyzeBehavior(metrics)
    {
        const signals=[];
        let score=0;
        if (!metrics||Object.keys(metrics).length===0) return {score: 0, signals: [{signal: 'No behavior data', detail: 'Anti-cheat not enabled', weight: 0}]};

        const pasteAttempts=metrics.pasteAttempts||0;
        if (pasteAttempts>=1) {const s=Math.min(pasteAttempts*15, 40); score+=s; signals.push({signal: 'Paste detected', detail: `${pasteAttempts} paste attempt(s)`, weight: s});}

        const tabSwitches=metrics.tabSwitches||0;
        if (tabSwitches>=2) {const s=Math.min(tabSwitches*8, 30); score+=s; signals.push({signal: 'Tab switches', detail: `${tabSwitches} switches (possible AI tool usage)`, weight: s});}

        const totalKeystrokes=metrics.totalKeystrokes||0;
        const codeLength=metrics.codeLength||0;
        if (codeLength>100&&totalKeystrokes<codeLength*0.3) {score+=25; signals.push({signal: 'Low keystroke ratio', detail: `${totalKeystrokes} keystrokes for ${codeLength} chars`, weight: 25});}

        const solveDuration=metrics.solveDuration||0;
        if (solveDuration>0&&solveDuration<60&&codeLength>200) {score+=20; signals.push({signal: 'Suspiciously fast', detail: `${solveDuration}s for ${codeLength} chars`, weight: 20});}

        const focusLosses=metrics.focusLosses||0;
        if (focusLosses>=3) {const s=Math.min(focusLosses*5, 15); score+=s; signals.push({signal: 'Frequent focus loss', detail: `${focusLosses} focus losses`, weight: s});}

        return {score: Math.min(score, 100), signals};
    }

    async groqDetection(code, language)
    {
        if (!this.apiKey) return null;
        const prompt=`Analyze the following ${language} code and determine if it was likely written by a human or generated by an AI.\n\nCODE:\n\`\`\`${language}\n${code}\n\`\`\`\n\nLook for AI signals (overly structured, comprehensive comments, boilerplate patterns, generic names, perfect error handling, textbook style, unusually clean) and human signals (inconsistent style, abbreviated names, sparse docs, iterative approach, personal quirks, minor imperfections).\n\nReturn ONLY valid JSON:\n{"score": <0-100>, "reasoning": "<2-3 sentences>", "signals": ["signal1"]}`;

        const response=await axios.post(this.apiUrl, {
            messages: [
                {role: 'system', content: 'You are an expert at detecting AI-generated code. Be accurate and fair. Return only valid JSON.'},
                {role: 'user', content: prompt}
            ],
            model: this.model, temperature: 0, seed: 42, stream: false
        }, {headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}`}});

        const text=response.data.choices[0].message.content;
        let cleaned=text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try
        {
            const parsed=JSON.parse(cleaned);
            return {score: typeof parsed.score==='number'? Math.min(Math.max(parsed.score, 0), 100):50, reasoning: parsed.reasoning||'Analysis completed', signals: Array.isArray(parsed.signals)? parsed.signals:[]};
        } catch (e)
        {
            return {score: 50, reasoning: 'Could not parse analysis', signals: []};
        }
    }

    getVerdict(score)
    {
        if (score<=20) return {label: 'Human Written', confidence: 'High', color: '#43e97b'};
        if (score<=40) return {label: 'Likely Human', confidence: 'Medium', color: '#a8e063'};
        if (score<=60) return {label: 'Uncertain', confidence: 'Low', color: '#ffc107'};
        if (score<=80) return {label: 'Likely AI-Generated', confidence: 'Medium', color: '#ff9800'};
        return {label: 'AI-Generated', confidence: 'High', color: '#ff5252'};
    }

    getSuggestions(score, heuristic, behavior, aiAnalysis)
    {
        const suggestions=[];
        if (behavior.score>30) suggestions.push('Multiple paste attempts and tab switches indicate external code copying.');
        if (heuristic.signals.some(s => s.signal.includes('comment'))) suggestions.push('Code contains comment patterns typical of AI generation.');
        if (heuristic.signals.some(s => s.signal.includes('docstring'))) suggestions.push('Comprehensive docstrings on all functions is unusual for timed challenges.');
        if (behavior.signals.some(s => s.signal.includes('fast'))) suggestions.push('Solution was completed unusually quickly for the code length.');
        if (score>60) suggestions.push('Consider asking the candidate to explain their approach verbally.');
        return suggestions;
    }
}

export default new AIDetector();
