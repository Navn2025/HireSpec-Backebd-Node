import axios from 'axios';

class GroqAnalyzer
{
    constructor()
    {
        this.apiKey=process.env.GROQ_API_KEY;
        this.apiUrl='https://api.groq.com/openai/v1/chat/completions';
        this.model='llama-3.3-70b-versatile';

        // Debug: Log API key status
        if (this.apiKey)
        {
            console.log('✅ GroqAnalyzer API Key loaded:', this.apiKey.substring(0, 8)+'...');
        } else
        {
            console.warn('⚠️  GroqAnalyzer: GROQ_API_KEY not found');
        }
    }

    async analyzeCode({code, language, executionResult})
    {
        try
        {
            const prompt=this.buildAnalysisPrompt(code, language, executionResult);
            const response=await axios.post(this.apiUrl, {
                messages: [
                    {role: 'system', content: 'You are an expert code reviewer and teacher. Analyze code thoroughly, identify mistakes, provide suggestions, and rate code quality. Return responses in valid JSON format only.'},
                    {role: 'user', content: prompt}
                ],
                model: this.model, temperature: 0, seed: 42, stream: false
            }, {
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}`}
            });
            const analysisText=response.data.choices[0].message.content;
            return this.parseGroqResponse(analysisText);
        } catch (error)
        {
            console.error('Groq API Error:', error.response?.data||error.message);
            return this.getFallbackAnalysis(code, language, executionResult);
        }
    }

    buildAnalysisPrompt(code, language, executionResult)
    {
        return `Analyze the following ${language} code comprehensively and provide detailed feedback.

CODE:
\`\`\`${language}
${code}
\`\`\`

${executionResult? `
EXECUTION RESULT:
- Output: ${executionResult.output||'None'}
- Errors: ${executionResult.errors||'None'}
- Execution Time: ${executionResult.executionTime}ms
- Has Error: ${executionResult.hasError}
` :''}

Please analyze and provide a JSON response with the following structure (return ONLY valid JSON, no markdown):
{
  "mistakes": [{ "type": "syntax|runtime|logic|quality", "line": null, "severity": "critical|warning|info", "message": "", "explanation": "", "fix": "" }],
  "suggestions": [{ "category": "performance|readability|best-practices|security", "title": "", "description": "", "codeExample": "" }],
  "qualityScore": 0,
  "complexity": { "timeComplexity": "", "spaceComplexity": "", "explanation": "" },
  "bestPractices": [{ "title": "", "description": "", "applied": true }],
  "improvements": [""]
}`;
    }

    parseGroqResponse(responseText)
    {
        try
        {
            let cleanText=responseText.trim();
            cleanText=cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const parsed=JSON.parse(cleanText);
            const rawComplexity=parsed.complexity||{};
            return {
                mistakes: Array.isArray(parsed.mistakes)? parsed.mistakes:[],
                suggestions: Array.isArray(parsed.suggestions)? parsed.suggestions:[],
                qualityScore: typeof parsed.qualityScore==='number'? parsed.qualityScore:70,
                complexity: {
                    time: rawComplexity.timeComplexity||rawComplexity.time||'Unknown',
                    space: rawComplexity.spaceComplexity||rawComplexity.space||'Unknown',
                    timeComplexity: rawComplexity.timeComplexity||rawComplexity.time||'Unknown',
                    spaceComplexity: rawComplexity.spaceComplexity||rawComplexity.space||'Unknown',
                    explanation: rawComplexity.explanation||'Complexity analysis not available'
                },
                bestPractices: Array.isArray(parsed.bestPractices)? parsed.bestPractices:[],
                improvements: Array.isArray(parsed.improvements)? parsed.improvements:[]
            };
        } catch (error)
        {
            console.error('Failed to parse Groq response:', error);
            return {
                mistakes: [],
                suggestions: [{category: 'general', title: 'AI Analysis', description: responseText.substring(0, 500), codeExample: null}],
                qualityScore: 70,
                complexity: {time: 'Unknown', space: 'Unknown', timeComplexity: 'Unknown', spaceComplexity: 'Unknown', explanation: 'Analysis in progress'},
                bestPractices: [],
                improvements: ['Review the AI feedback for detailed insights']
            };
        }
    }

    getFallbackAnalysis(code, language, executionResult)
    {
        const mistakes=[];
        const suggestions=[];
        if (executionResult&&executionResult.hasError)
        {
            mistakes.push({type: executionResult.errors.includes('Syntax')? 'syntax':'runtime', line: null, severity: 'critical', message: 'Code execution failed', explanation: executionResult.errors, fix: 'Review the error message and fix the indicated issues'});
        }
        const lines=code.split('\n').length;
        if (lines>100)
        {
            suggestions.push({category: 'readability', title: 'Code Length', description: 'Consider breaking down long functions into smaller, reusable components', codeExample: null});
        }
        if (/\b[a-z]\b/.test(code)&&language!=='c')
        {
            suggestions.push({category: 'best-practices', title: 'Variable Naming', description: 'Use descriptive variable names instead of single letters', codeExample: 'Use "count" instead of "c", "index" instead of "i" (except in loops)'});
        }
        return {
            mistakes, suggestions,
            qualityScore: executionResult&&!executionResult.hasError? 75:50,
            complexity: {time: 'Analysis not available', space: 'Analysis not available', timeComplexity: 'Analysis not available', spaceComplexity: 'Analysis not available', explanation: 'Connect to Groq API for detailed complexity analysis'},
            bestPractices: [{title: 'Code Documentation', description: 'Add comments to explain complex logic', applied: code.includes('//')||code.includes('#')}],
            improvements: ['Connect Groq API key for detailed AI-powered analysis', 'Review code for syntax and logic errors', 'Consider adding error handling']
        };
    }

    async getSuggestions(code, language)
    {
        try
        {
            const prompt=`Provide 5 specific improvement suggestions for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nReturn as JSON array with objects containing: category, title, description, codeExample`;
            const response=await axios.post(this.apiUrl, {
                messages: [
                    {role: 'system', content: 'You are a helpful coding assistant. Provide practical suggestions.'},
                    {role: 'user', content: prompt}
                ],
                model: this.model, temperature: 0.7
            }, {
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}`}
            });
            const suggestionsText=response.data.choices[0].message.content;
            const suggestions=JSON.parse(suggestionsText.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
            return Array.isArray(suggestions)? suggestions:[];
        } catch (error)
        {
            console.error('Suggestions error:', error.message);
            return [{category: 'general', title: 'Connect Groq API', description: 'Add your Groq API key to get AI-powered suggestions', codeExample: null}];
        }
    }
}

export default new GroqAnalyzer();
