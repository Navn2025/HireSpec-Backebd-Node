import express from 'express';
import axios from 'axios';
import testRunner from '../services/testRunner.js';

const router=express.Router();

function buildQuestionPrompt(difficulty, topics, language)
{
    const difficultyLevel=difficulty||'Medium';
    const topicList=topics&&topics.length>0? topics.join(', '):'algorithms and data structures';
    const lang=language||'python';
    return `Generate a unique ${difficultyLevel} coding problem focused on ${topicList}.

CRITICAL RULES:
- The problem must have ONE clear, unambiguous algorithm.
- Every test case output MUST be exactly what the reference solution produces.
- Provide a correct reference solution.
- Test case inputs must be JSON objects with keys matching the function parameters.
- Test case outputs must be actual values (arrays, numbers, booleans, strings).

Requirements:
- Clear problem statement
- 2-3 examples with short explanations
- Constraints
- At least 5 test cases (3 visible, 2 hidden) with CORRECT expected outputs
- Starter code for python, javascript, java, cpp
- A correct reference solution in ${lang}
- 2-3 hints

Return ONLY valid JSON (no markdown):
{
  "title": "Problem Title",
  "description": "Clear problem description",
  "examples": [{"input": "", "output": "", "explanation": ""}],
  "constraints": [],
  "hints": [],
  "referenceSolution": "def function_name(params):\\n    return result",
  "testCases": [{"input": {"param1": [1,2,3]}, "output": 10, "hidden": false}],
  "starterCode": {"python": "", "javascript": "", "java": "", "cpp": ""},
  "functionName": {"python": "", "javascript": "", "java": "", "cpp": ""}
}`;
}

function parseQuestionResponse(responseText)
{
    try
    {
        let cleaned=responseText.trim();
        if (cleaned.startsWith('```json')) cleaned=cleaned.substring(7);
        else if (cleaned.startsWith('```')) cleaned=cleaned.substring(3);
        if (cleaned.endsWith('```')) cleaned=cleaned.substring(0, cleaned.length-3);
        cleaned=cleaned.trim();
        const question=JSON.parse(cleaned);
        if (!question.title||!question.description) throw new Error('Missing required fields');
        question.examples=question.examples||[];
        question.constraints=question.constraints||[];
        question.hints=question.hints||[];
        question.testCases=question.testCases||[];
        question.starterCode=question.starterCode||{};
        question.functionName=question.functionName||{};
        return question;
    } catch (error)
    {
        console.error('Failed to parse AI question:', error);
        return {title: 'AI Generated Problem', description: 'The AI generated response could not be parsed. Please try again.', examples: [], constraints: [], hints: [], testCases: [], starterCode: {}, functionName: {}};
    }
}

function detectLanguage(code)
{
    if (code.includes('def ')&&code.includes(':')) return 'python';
    if (code.includes('function ')||code.includes('=>')||code.includes('const ')) return 'javascript';
    if (code.includes('public class')||code.includes('public static')) return 'java';
    if (code.includes('#include')||code.includes('std::')) return 'cpp';
    return null;
}

async function validateAndFixTestCases(question, language)
{
    const refSolution=question.referenceSolution;
    const funcName=question.functionName;
    if (!refSolution||!funcName) return question;
    const lang=detectLanguage(refSolution)||language||'python';
    let fixedCount=0;

    for (let i=0;i<question.testCases.length;i++)
    {
        const tc=question.testCases[i];
        try
        {
            let normalizedInput=tc.input;
            if (typeof normalizedInput==='string') normalizedInput={__raw: normalizedInput};
            else if (Array.isArray(normalizedInput))
            {
                const obj={};
                normalizedInput.forEach((val, idx) => {obj['param'+idx]=val;});
                normalizedInput=obj;
            }
            const testCase={input: normalizedInput, output: tc.output, hidden: tc.hidden};
            const testCode=testRunner.generateTestCode(refSolution, lang, testCase, funcName);
            const result=await testRunner.executeCode(testCode, lang);
            if (result.output&&!result.error)
            {
                let actualOutput;
                try {actualOutput=JSON.parse(result.output.trim());} catch (e) {actualOutput=result.output.trim();}
                if (JSON.stringify(tc.output)!==JSON.stringify(actualOutput))
                {
                    console.log(`[AI Validation] Test case ${i+1}: Expected ${JSON.stringify(tc.output)} but ref solution produced ${JSON.stringify(actualOutput)}. Fixing.`);
                    question.testCases[i].output=actualOutput;
                    fixedCount++;
                }
            }
        } catch (err) {console.warn(`[AI Validation] Failed to validate test case ${i+1}:`, err.message);}
    }
    if (fixedCount>0) console.log(`[AI Validation] Fixed ${fixedCount}/${question.testCases.length} test cases for "${question.title}"`);
    delete question.referenceSolution;
    return question;
}

// Generate AI coding question
router.post('/generate', async (req, res) =>
{
    try
    {
        const {difficulty, topics, language}=req.body;
        if (!process.env.GROQ_API_KEY) return res.status(500).json({success: false, error: 'Groq API key not configured'});

        const prompt=buildQuestionPrompt(difficulty, topics, language);
        const response=await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            messages: [
                {role: 'system', content: 'You are an expert coding question generator. Return ONLY valid JSON. Every test case output MUST be correct. Test case inputs must be JSON objects.'},
                {role: 'user', content: prompt}
            ],
            model: 'llama-3.3-70b-versatile', temperature: 0.3, seed: Math.floor(Math.random()*10000), stream: false
        }, {headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}});

        const question=parseQuestionResponse(response.data.choices[0].message.content);
        question.id='ai_'+Date.now();
        question.difficulty=difficulty||'Medium';
        question.topics=topics||['AI Generated'];
        question.domain='AI Generated';
        question.companies=[];
        question.isAIGenerated=true;

        if (question.referenceSolution&&question.testCases?.length>0)
        {
            try
            {
                const validated=await validateAndFixTestCases(question, language||'python');
                res.json({success: true, question: validated});
            } catch (valError)
            {
                console.warn('Test case validation failed:', valError.message);
                delete question.referenceSolution;
                res.json({success: true, question});
            }
        } else
        {
            delete question.referenceSolution;
            res.json({success: true, question});
        }
    } catch (error)
    {
        console.error('AI Question Generation Error:', error.response?.data||error.message);
        res.status(500).json({success: false, error: error.response?.data?.error?.message||error.message});
    }
});

// Run tests for AI-generated questions
router.post('/run-tests', async (req, res) =>
{
    try
    {
        const {code, language, testCases, functionName}=req.body;
        if (!code||!language||!testCases||testCases.length===0) return res.status(400).json({success: false, error: 'Missing required fields'});

        const normalizedTestCases=testCases.map(tc =>
        {
            let normalizedInput=tc.input;
            if (typeof normalizedInput==='string') normalizedInput={__raw: normalizedInput};
            else if (Array.isArray(normalizedInput))
            {
                const obj={};
                normalizedInput.forEach((val, i) => {obj['param'+i]=val;});
                normalizedInput=obj;
            }
            let normalizedOutput=tc.output!==undefined? tc.output:tc.expectedOutput;
            if (typeof normalizedOutput==='string') {try {normalizedOutput=JSON.parse(normalizedOutput);} catch (e) {} }
            return {input: normalizedInput, output: normalizedOutput, hidden: tc.hidden||false};
        });

        const testResults=await testRunner.runTests(code, language, normalizedTestCases, functionName);
        res.json({
            success: true,
            message: testResults.allPassed? 'Accepted! All test cases passed.':'Wrong Answer. Some test cases failed.',
            solved: testResults.allPassed,
            results: {
                allPassed: testResults.allPassed, totalTests: testResults.totalTests,
                passedTests: testResults.passedTests, failedTests: testResults.failedTests,
                hiddenPassed: testResults.hiddenPassed, hiddenTotal: testResults.hiddenTotal,
                visibleTests: testResults.testResults.filter(t => !t.hidden)
            }
        });
    } catch (error)
    {
        console.error('AI Question Run Tests Error:', error);
        res.status(500).json({success: false, error: error.message});
    }
});

export default router;
