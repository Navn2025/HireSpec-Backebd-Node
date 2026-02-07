import express from 'express';
import axios from 'axios';

const router=express.Router();

// Generate AI question using Groq
router.post('/generate-question', async (req, res) =>
{
    try
    {
        const {difficulty, category, customPrompt}=req.body;

        const prompt=customPrompt||`Generate a coding interview question with the following requirements:
- Difficulty: ${difficulty||'medium'}
- Category: ${category||'algorithms'}

Provide the response in this exact JSON format:
{
  "title": "Question Title",
  "difficulty": "${difficulty||'medium'}",
  "category": "${category||'algorithms'}",
  "description": "Detailed description of the problem with clear requirements",
  "examples": [
    {"input": "example input", "output": "example output"},
    {"input": "another input", "output": "another output"}
  ],
  "constraints": ["constraint 1", "constraint 2"],
  "hints": ["hint 1", "hint 2"],
  "starterCode": {
    "python": "def solution():\\n    pass",
    "javascript": "function solution() {\\n    // your code here\\n}",
    "java": "public class Solution {\\n    // your code here\\n}"
  }
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer. Generate challenging, realistic coding interview questions in valid JSON format only. Include starter code for Python, JavaScript, and Java.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.7,
                max_tokens: 1500,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        const jsonMatch=response.match(/\{[\s\S]*\}/);

        let question;
        if (jsonMatch)
        {
            question=JSON.parse(jsonMatch[0]);
            // Ensure starter code exists
            if (!question.starterCode)
            {
                question.starterCode={
                    python: 'def solution():\n    pass',
                    javascript: 'function solution() {\n    // your code here\n}',
                    java: 'public class Solution {\n    // your code here\n}',
                };
            }
        } else
        {
            // Fallback
            question={
                title: 'Find Maximum Subarray Sum',
                difficulty: difficulty||'medium',
                category: category||'arrays',
                description: 'Given an integer array, find the contiguous subarray which has the largest sum and return its sum.',
                examples: [
                    {input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6'},
                    {input: 'nums = [1]', output: '1'}
                ],
                constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
                hints: ['Try using dynamic programming', 'Keep track of the current sum'],
                starterCode: {
                    python: 'def maxSubArray(nums):\n    pass',
                    javascript: 'function maxSubArray(nums) {\n    // your code here\n}',
                    java: 'public int maxSubArray(int[] nums) {\n    // your code here\n}',
                },
            };
        }

        res.json({question});
    } catch (error)
    {
        console.error('Groq API error:', error);
        // Fallback response
        res.json({
            question: {
                title: 'Find Maximum Subarray Sum',
                difficulty: req.body.difficulty||'medium',
                category: req.body.category||'algorithms',
                description: 'Given an integer array, find the contiguous subarray which has the largest sum and return its sum.',
                examples: [
                    {input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6'},
                    {input: 'nums = [1]', output: '1'}
                ],
                starterCode: {
                    python: 'def maxSubArray(nums):\n    pass',
                    javascript: 'function maxSubArray(nums) {\n    // your code here\n}',
                    java: 'public int maxSubArray(int[] nums) {\n    // your code here\n}',
                },
            },
        });
    }
});

// Legacy endpoint for backward compatibility
router.post('/ask-question', async (req, res) =>
{
    return router.handle({...req, url: '/generate-question'}, res);
});

// Evaluate code with AI using Groq
router.post('/evaluate-code', async (req, res) =>
{
    try
    {
        const {code, language, question}=req.body;

        const prompt=`Evaluate this ${language} code for the following problem:
Problem: ${question}

Code:
\`\`\`${language}
${code}
\`\`\`

Provide detailed feedback in JSON format:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "codeQuality": 8.5,
  "suggestions": ["suggestion 1", "suggestion 2"],
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "securityIssues": ["issue 1"]
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert code reviewer. Analyze code thoroughly for correctness, efficiency, and best practices. Return JSON only.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: 'llama-3.1-70b-versatile',
                temperature: 0.5,
                max_tokens: 1500,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        const jsonMatch=response.match(/\{[\s\S]*\}/);
        const feedback=jsonMatch? JSON.parse(jsonMatch[0]):{
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(1)',
            codeQuality: 7.5,
            suggestions: ['Add error handling', 'Consider edge cases'],
            strengths: ['Clean code structure'],
            improvements: ['Add comments', 'Optimize performance'],
        };

        res.json({feedback});
    } catch (error)
    {
        console.error('Groq API error:', error);
        res.json({
            feedback: {
                timeComplexity: 'O(n)',
                spaceComplexity: 'O(1)',
                codeQuality: 7.5,
                suggestions: ['Consider edge cases'],
                strengths: ['Code structure is readable'],
                improvements: ['Add error handling'],
            },
        });
    }
});

// Generate comprehensive AI feedback
router.post('/generate-feedback', async (req, res) =>
{
    try
    {
        const {interviewData, code, questions, proctoringScore}=req.body;

        const prompt=`Generate comprehensive interview feedback for a candidate:

Interview Performance:
- Questions attempted: ${questions||'N/A'}
- Code quality: ${code? 'Submitted':'Not submitted'}
- Proctoring integrity score: ${proctoringScore||100}/100

Provide detailed feedback in JSON format:
{
  "overallScore": 7.5,
  "strengths": ["strength 1", "strength 2"],
  "areasForImprovement": ["area 1", "area 2"],
  "detailedFeedback": "Comprehensive paragraph about performance",
  "technicalSkills": 8.0,
  "problemSolving": 7.5,
  "communication": 8.0,
  "recommendation": "Recommend for next round / Need more practice / Strong hire"
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer providing comprehensive candidate evaluations. Return JSON only.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: 'llama-3.1-70b-versatile',
                temperature: 0.6,
                max_tokens: 2000,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        const jsonMatch=response.match(/\{[\s\S]*\}/);
        const feedback=jsonMatch? JSON.parse(jsonMatch[0]):{
            overallScore: 7.5,
            strengths: ['Good problem-solving', 'Clear communication'],
            areasForImprovement: ['Edge case handling'],
            detailedFeedback: 'The candidate showed good technical skills.',
            recommendation: 'Recommend for next round',
        };

        res.json(feedback);
    } catch (error)
    {
        console.error('Groq API error:', error);
        res.json({
            overallScore: 7.5,
            strengths: ['Completed the interview', 'Showed technical knowledge'],
            areasForImprovement: ['Continue practicing'],
            detailedFeedback: 'The candidate demonstrated technical competence.',
            recommendation: 'Proceed to next evaluation',
        });
    }
});

// AI interviewer chat using Groq
router.post('/interview-chat', async (req, res) =>
{
    try
    {
        const {message, conversationHistory, currentQuestion}=req.body;

        const systemPrompt=`You are an AI technical interviewer conducting a coding interview. 
Current question context: ${currentQuestion||'General interview discussion'}

Guidelines:
- Be professional and encouraging
- Ask probing questions about time/space complexity
- Suggest optimizations when appropriate
- Provide hints without giving away the solution
- Keep responses concise (2-3 sentences)`;

        const messages=[
            {role: 'system', content: systemPrompt},
            ...(conversationHistory||[]),
            {role: 'user', content: message}
        ];

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: messages,
                model: 'llama-3.1-8b-instant',
                temperature: 0.7,
                max_tokens: 300,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||
            "That's a good approach. Can you explain the time complexity?";

        res.json({
            response: response,
            nextAction: 'continue',
        });
    } catch (error)
    {
        console.error('Groq API error:', error);
        const fallbackResponses=[
            "That's a good approach. Can you explain the time complexity?",
            "Interesting solution. How would you handle edge cases?",
            "Great! Can you optimize this further?",
            "Good thinking. What's the space complexity of your solution?",
        ];
        res.json({
            response: fallbackResponses[Math.floor(Math.random()*fallbackResponses.length)],
            nextAction: 'continue',
        });
    }
});

export default router;
