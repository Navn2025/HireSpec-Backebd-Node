import express from 'express';
import axios from 'axios';

const router=express.Router();

// In-memory storage for practice sessions
const practiceSessions=new Map();

// Parse AI-generated question response
function parseQuestionResponse(response, interviewType)
{
    try
    {
        // Remove markdown code blocks if present
        let cleaned=response.trim();
        cleaned=cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Extract JSON object
        const jsonMatch=cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
        {
            throw new Error('No JSON found in response');
        }
        
        const parsed=JSON.parse(jsonMatch[0]);
        
        // Validate required fields
        if (!parsed.question)
        {
            throw new Error('Missing required field: question');
        }
        
        // For coding questions, validate additional fields
        if (interviewType==='coding')
        {
            if (!parsed.testCases||!Array.isArray(parsed.testCases)||parsed.testCases.length===0)
            {
                throw new Error('Coding question missing valid test cases');
            }
            if (!parsed.starterCode||typeof parsed.starterCode!=='object')
            {
                throw new Error('Coding question missing starter code');
            }
            if (!parsed.functionName)
            {
                throw new Error('Coding question missing functionName');
            }
        }
        
        return {
            question: parsed.question,
            type: interviewType,
            expectedPoints: parsed.expectedPoints||[],
            hints: parsed.hints||[],
            testCases: parsed.testCases,
            starterCode: parsed.starterCode,
            functionName: parsed.functionName,
        };
    } catch (error)
    {
        console.error('Error parsing AI question response:', error.message);
        return null;
    }
}

// Start practice session with AI greeting
router.post('/start', async (req, res) =>
{
    try
    {
        const {sessionId, role, difficulty, interviewType, mode}=req.body;

        // Generate personalized AI greeting
        const roleDisplay=role.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const questionCount=getModeQuestionCount(mode);

        let greeting=`Hello! I'm your AI interviewer for today's ${interviewType} interview. We'll be assessing your skills for the ${roleDisplay} role. I'll ask you ${questionCount} questions, and feel free to ask for clarification at any time. Let's get started!`;

        try
        {
            const greetingPrompt=`You are conducting a ${interviewType} interview for a ${roleDisplay} position (${difficulty} level).

Create a brief, warm professional greeting (2-3 sentences) that:
- Introduces yourself as the interviewer
- Mentions ${questionCount} questions
- Encourages honest answers

JSON format: {"greeting": "your message"}`;

            const completion=await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    messages: [
                        {role: 'system', content: 'You are a friendly, professional interviewer.'},
                        {role: 'user', content: greetingPrompt}
                    ],
                    model: 'llama-3.1-8b-instant',
                    temperature: 0.8,
                    max_tokens: 250,
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
            if (jsonMatch)
            {
                greeting=JSON.parse(jsonMatch[0]).greeting;
            }
        } catch (err)
        {
            console.log('Using default greeting');
        }

        const session={
            sessionId,
            role,
            difficulty,
            interviewType,
            mode,
            questions: [],
            currentQuestion: 0,
            answers: [],
            startTime: new Date(),
            score: null,
            greeting,
            phase: 'greeting',
            currentDifficulty: difficulty,
        };

        practiceSessions.set(sessionId, session);

        res.json({success: true, sessionId, greeting});
    } catch (error)
    {
        console.error('Error starting practice session:', error);
        res.status(500).json({error: 'Failed to start session'});
    }
});

// Get next question using AI
router.post('/next-question', async (req, res) =>
{
    try
    {
        const {sessionId, previousAnswer}=req.body;
        const session=practiceSessions.get(sessionId);

        if (!session)
        {
            return res.status(404).json({error: 'Session not found'});
        }

        // Update session phase
        session.phase='interviewing';

        // Determine difficulty adjustment and generate transition message
        let adjustedDifficulty=session.difficulty;
        let transitionMessage='';

        if (previousAnswer)
        {
            // Adaptive difficulty: if user did well, increase difficulty
            const wasCorrect=previousAnswer.score>=7;
            if (wasCorrect&&session.difficulty==='easy')
            {
                adjustedDifficulty='medium';
                transitionMessage="Great work! Let's challenge you a bit more with the next one.";
            } else if (wasCorrect&&session.difficulty==='medium')
            {
                adjustedDifficulty='hard';
                transitionMessage="Excellent! Here's a more advanced question.";
            } else if (!wasCorrect&&session.difficulty==='hard')
            {
                adjustedDifficulty='medium';
                transitionMessage="Alright, let's try a different approach.";
            } else if (wasCorrect)
            {
                transitionMessage='Good! Moving to the next question.';
            } else
            {
                transitionMessage="I see. Let's continue.";
            }
        } else
        {
            transitionMessage="Let's begin with your first question.";
        }

        // Generate AI question based on context
        const prompt=generateQuestionPrompt(session.role, adjustedDifficulty, session.interviewType, session.questions.length);

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: session.interviewType==='coding'?
                            `You are an expert coding interviewer. Generate clear, solvable coding problems with correct test cases. Return ONLY valid JSON.`:
                            `You are an expert technical interviewer. Generate interview questions in JSON format.`
                    },
                    {role: 'user', content: prompt}
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0.7,
                max_tokens: session.interviewType==='coding'? 1500:1000,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        console.log('AI Question Response:', response);
        
        // Parse AI response with validation
        let question=parseQuestionResponse(response, session.interviewType);
        
        // If parsing failed, use fallback
        if (!question)
        {
            console.log('Parsing failed, using fallback question');
            question=generateFallbackQuestion(session);
        }

        question.questionNumber=session.questions.length+1;
        question.adjustedDifficulty=adjustedDifficulty;

        session.questions.push(question);
        session.currentDifficulty=adjustedDifficulty;
        practiceSessions.set(sessionId, session);

        res.json({
            question,
            totalQuestions: getModeQuestionCount(session.mode),
            transitionMessage,
            currentDifficulty: adjustedDifficulty
        });
    } catch (error)
    {
        console.error('Error generating question:', error.message);
        console.error('Full error:', error);
        // Fallback
        const session=practiceSessions.get(req.body.sessionId);
        const fallback=generateFallbackQuestion(session);
        fallback.questionNumber=session.questions.length+1;
        fallback.adjustedDifficulty=session.difficulty;
        session.questions.push(fallback);
        practiceSessions.set(req.body.sessionId, session);
        res.json({
            question: fallback,
            totalQuestions: getModeQuestionCount(session?.mode||'quick'),
            transitionMessage: session.questions.length===1? "Let's begin with your first question.":'Next question.',
            currentDifficulty: session.difficulty
        })
    }
});

// Evaluate answer using AI
router.post('/evaluate-answer', async (req, res) =>
{
    try
    {
        const {sessionId, questionId, answer}=req.body;
        const session=practiceSessions.get(sessionId);

        if (!session)
        {
            return res.status(404).json({error: 'Session not found'});
        }

        const question=session.questions.find(q => q.questionNumber===questionId);

        // Build context for better evaluation
        const avgScore=session.answers.length>0?
            (session.answers.reduce((sum, a) => sum+a.evaluation.score, 0)/session.answers.length).toFixed(1)
            :'N/A';

        const prompt=`You are interviewing a candidate for ${session.role.replace('-', ' ')} position (${session.currentDifficulty} level).

**Question you asked:** ${question.question}
**Candidate's answer:** ${answer}
**Expected key points:** ${question.expectedPoints?.join(', ')||'N/A'}
**Their average score so far:** ${avgScore}/10

**Evaluation rules:**
1. Score honestly: 1-2 (irrelevant/wrong), 3-4 (very basic), 5-6 (partial understanding), 7-8 (good with minor gaps), 9-10 (excellent)
2. DO NOT reveal correct answers or what they missed
3. Be conversational like a human interviewer: "I see...", "That's interesting...", "Good point about..."
4. Ask a natural follow-up to dig deeper (REQUIRED - never null)
5. Keep feedback brief and encouraging

JSON format:
{
  "score": 7,
  "feedback": "I see you understand the core concept. Your explanation of X was clear, though...",
  "strengths": ["Point A", "Point B"],
  "improvements": ["Could elaborate on...", "Consider..."],
  "followUp": "Interesting. Now, can you tell me..."
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional interviewer. Be conversational, fair, and never reveal answers during the interview.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0.6,
                max_tokens: 700,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        console.log('AI Evaluation Response:', response);
        const jsonMatch=response.match(/\{[\s\S]*\}/);

        // Better fallback evaluation based on answer length and content
        let evaluation;
        if (jsonMatch)
        {
            evaluation=JSON.parse(jsonMatch[0]);
        } else
        {
            // Analyze answer quality for better fallback score
            const answerLength=answer.trim().length;
            const hasKeywords=question.expectedPoints?.some(point =>
                answer.toLowerCase().includes(point.toLowerCase().split(' ')[0])
            );

            let score;
            if (answerLength<20)
            {
                score=2;
            } else if (answerLength<50)
            {
                score=hasKeywords? 4:3;
            } else if (answerLength<150)
            {
                score=hasKeywords? 6:5;
            } else
            {
                score=hasKeywords? 8:7;
            }

            evaluation={
                score,
                feedback: `Your answer is ${answerLength<50? 'too brief':'well-detailed'}. ${hasKeywords? 'You touched on some key points.':'Try to cover the expected points mentioned in hints.'}`,
                strengths: answerLength>=100? ['Detailed response', 'Good attempt']:['Attempted the question'],
                improvements: answerLength<100? ['Provide more details', 'Explain your reasoning']:['Could add more specific examples'],
                followUp: hasKeywords? 'Can you elaborate on how you would apply this in a real-world scenario?':null,
            };
        }

        session.answers.push({
            questionId,
            answer,
            evaluation,
            timestamp: new Date(),
        });

        practiceSessions.set(sessionId, session);

        res.json({evaluation});
    } catch (error)
    {
        console.error('Error evaluating answer:', error.message);
        console.error('Full error:', error);

        // Better fallback based on answer analysis
        const answerLength=req.body.answer?.trim().length||0;
        const score=answerLength<20? 2:answerLength<100? 4:6;

        res.json({
            evaluation: {
                score,
                feedback: answerLength<50? 'Your answer is too brief. Please provide more detail.':'Your answer has been recorded. Try to be more specific.',
                strengths: answerLength>=50? ['Good effort', 'Attempted the question']:['Attempted the question'],
                improvements: answerLength<100? ['Provide much more detail', 'Explain your reasoning', 'Use specific examples']:['Be more specific', 'Add examples'],
                followUp: null,
            }
        });
    }
});

// Generate final feedback
router.post('/finish', async (req, res) =>
{
    try
    {
        const {sessionId}=req.body;
        const session=practiceSessions.get(sessionId);

        if (!session)
        {
            return res.status(404).json({error: 'Session not found'});
        }

        session.endTime=new Date();

        // Calculate scores
        const scores={
            technical: calculateTechnicalScore(session.answers),
            communication: calculateCommunicationScore(session.answers),
            problemSolving: calculateProblemSolvingScore(session.answers),
            confidence: calculateConfidenceScore(session.answers),
        };

        const overallScore=Object.values(scores).reduce((a, b) => a+b, 0)/Object.keys(scores).length;

        // Generate AI feedback
        const summaryPrompt=`Generate interview feedback report:

Session Type: ${session.interviewType}
Role: ${session.role}
Questions: ${session.questions.length}
Average Score: ${overallScore.toFixed(1)}

Answers summary:
${session.answers.map((a, i) => `Q${i+1}: Score ${a.evaluation.score}/10`).join('\n')}

Provide comprehensive feedback in JSON:
{
  "overallScore": ${overallScore.toFixed(1)},
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestedTopics": ["topic 1", "topic 2", "topic 3"],
  "summary": "Overall assessment paragraph"
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are providing final interview feedback. Be encouraging but honest.'
                    },
                    {role: 'user', content: summaryPrompt}
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0.6,
                max_tokens: 1200,
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
        const aiFeedback=jsonMatch? JSON.parse(jsonMatch[0]):null;

        const feedback={
            sessionId,
            scores,
            overallScore,
            totalQuestions: session.questions.length,
            duration: Math.floor((session.endTime-session.startTime)/1000/60),
            strengths: aiFeedback?.strengths||['Completed the interview', 'Answered all questions'],
            weaknesses: aiFeedback?.weaknesses||['Could provide more detailed responses'],
            suggestedTopics: aiFeedback?.suggestedTopics||['Review core concepts'],
            summary: aiFeedback?.summary||'You completed the practice interview. Keep practicing to improve!',
            detailedAnswers: session.answers,
        };

        session.feedback=feedback;
        practiceSessions.set(sessionId, session);

        res.json({feedback});
    } catch (error)
    {
        console.error('Error generating feedback:', error);
        res.status(500).json({error: 'Failed to generate feedback'});
    }
});

// Helper functions
function generateQuestionPrompt(role, difficulty, type, questionNumber)
{
    const roleDescriptions={
        'frontend-developer': 'Frontend Development (React, JavaScript, CSS, HTML)',
        'backend-developer': 'Backend Development (Node.js, APIs, Databases)',
        'fullstack-developer': 'Full Stack Development',
        'data-science': 'Data Science (Python, ML, Statistics)',
        'devops': 'DevOps (CI/CD, Docker, Kubernetes)',
        'mobile-developer': 'Mobile Development (React Native, iOS, Android)',
    };

    const typeDescriptions={
        'technical': 'technical concept question',
        'behavioral': 'behavioral question about past experience',
        'coding': 'coding problem to solve',
        'system-design': 'system design question',
    };

    const roleDisplay=roleDescriptions[role]||role;
    const typeDisplay=typeDescriptions[type]||type;

    // Enhanced prompt for coding questions
    if (type==='coding')
    {
        return `Generate a unique ${difficulty} level coding problem for a ${roleDisplay} interview.

**CRITICAL REQUIREMENTS:**
1. Return ONLY valid JSON - no markdown, no code blocks
2. Problem must be clear and solvable in 10-15 minutes
3. Include 3-4 test cases with correct inputs and outputs
4. Provide starter code for Python, JavaScript, Java
5. Add 2-3 helpful hints

**Problem Guidelines:**
- ${difficulty==='easy'? 'Focus on basic arrays, strings, or simple logic':'Advanced algorithms, data structures, or optimization'}
- Clear, unambiguous problem statement
- Include example walkthrough
- All test cases must have verifiable correct outputs

Return ONLY this JSON structure:
{
  "question": "Clear problem description with examples",
  "type": "coding",
  "difficulty": "${difficulty}",
  "expectedPoints": ["Key concept 1", "Key concept 2", "Key concept 3"],
  "hints": ["Hint 1", "Hint 2", "Hint 3"],
  "testCases": [
    {
      "input": {"nums": [1,2,3], "target": 4},
      "output": [0, 2],
      "hidden": false
    },
    {
      "input": {"nums": [2,7,11,15], "target": 9},
      "output": [0, 1],
      "hidden": true
    }
  ],
  "starterCode": {
    "python": "def function_name(param):\\n    # Your code here\\n    pass",
    "javascript": "function functionName(param) {\\n    // Your code here\\n}",
    "java": "public class Solution {\\n    public ReturnType functionName(Type param) {\\n        // Your code here\\n    }\\n}"
  },
  "functionName": "function_name"
}`;
    }

    // Regular technical/behavioral/system-design questions
    return `Generate interview question #${questionNumber+1} for a ${roleDisplay} position.

Type: ${typeDisplay}
Difficulty: ${difficulty}

Make it conversational and relevant to ${roleDisplay}.

Return ONLY valid JSON:
{
  "question": "The interview question",
  "type": "${type}",
  "expectedPoints": ["key point 1", "key point 2", "key point 3"],
  "hints": ["hint 1", "hint 2"]
}`;
}

function generateFallbackQuestion(session)
{
    const roleQuestions={
        'frontend-developer': {
            technical: {question: 'Explain the Virtual DOM in React and why it improves performance.', expectedPoints: ['Diffing algorithm', 'Batch updates', 'Reconciliation'], hints: ['Think about DOM manipulation cost', 'Consider update batching']},
            behavioral: {question: 'Describe a time you optimized a slow frontend application.', expectedPoints: ['Identified bottleneck', 'Solution implemented', 'Results measured'], hints: ['Use STAR method']},
            coding: {
                question: 'Write a function to debounce user input. Given a function and a delay in milliseconds, return a debounced version that delays invoking the function until after the delay has elapsed since the last time it was invoked.',
                expectedPoints: ['Closure usage', 'Timeout management', 'Clear previous timeout'],
                hints: ['Use setTimeout and clearTimeout', 'Store timer reference in closure'],
                testCases: [
                    {input: {delay: 100, calls: 3}, output: 1, hidden: false},
                    {input: {delay: 200, calls: 5}, output: 1, hidden: true}
                ],
                starterCode: {
                    python: 'def debounce(func, delay):\n    # Your code here\n    pass',
                    javascript: 'function debounce(func, delay) {\n    // Your code here\n}',
                    java: 'public class Solution {\n    public Function debounce(Function func, int delay) {\n        // Your code here\n    }\n}'
                },
                functionName: 'debounce'
            },
        },
        'backend-developer': {
            technical: {question: 'Explain RESTful API design principles and best practices.', expectedPoints: ['HTTP methods', 'Resource naming', 'Status codes'], hints: ['Think about statelessness', 'Consider versioning']},
            behavioral: {question: 'Tell me about a time you designed a scalable backend system.', expectedPoints: ['Architecture decisions', 'Scaling strategy', 'Results'], hints: ['Use STAR method']},
            coding: {
                question: 'Implement a rate limiter that allows at most N requests per time window. Return true if the request is allowed, false otherwise.',
                expectedPoints: ['Sliding window', 'Timestamp tracking', 'Efficient cleanup'],
                hints: ['Use a queue or array to track timestamps', 'Remove old timestamps before checking'],
                testCases: [
                    {input: {maxRequests: 3, windowMs: 1000, timestamps: [100, 200, 300]}, output: true, hidden: false},
                    {input: {maxRequests: 2, windowMs: 1000, timestamps: [100, 200, 250]}, output: false, hidden: true}
                ],
                starterCode: {
                    python: 'class RateLimiter:\n    def __init__(self, max_requests, window_ms):\n        pass\n    \n    def allow_request(self):\n        pass',
                    javascript: 'class RateLimiter {\n    constructor(maxRequests, windowMs) {\n        // Your code here\n    }\n    \n    allowRequest() {\n        // Your code here\n    }\n}',
                    java: 'public class RateLimiter {\n    public RateLimiter(int maxRequests, int windowMs) {\n        // Your code here\n    }\n    \n    public boolean allowRequest() {\n        // Your code here\n    }\n}'
                },
                functionName: 'RateLimiter'
            },
        },
        'data-science': {
            technical: {question: 'Explain the bias-variance tradeoff in machine learning.', expectedPoints: ['Underfitting vs overfitting', 'Model complexity', 'Training vs test error'], hints: ['Think about model complexity', 'Consider cross-validation']},
            behavioral: {question: 'Describe a challenging data analysis project and how you approached it.', expectedPoints: ['Problem definition', 'Methodology', 'Insights gained'], hints: ['Use STAR method']},
            coding: {
                question: 'Implement a function to calculate the Euclidean distance between two points in N-dimensional space. Points are given as lists/arrays of coordinates.',
                expectedPoints: ['Square of differences', 'Sum and square root', 'Handle multiple dimensions'],
                hints: ['Formula: sqrt(sum((x[i] - y[i])^2))', 'Use math.sqrt or equivalent'],
                testCases: [
                    {input: {point1: [0, 0], point2: [3, 4]}, output: 5.0, hidden: false},
                    {input: {point1: [1, 2, 3], point2: [4, 5, 6]}, output: 5.196, hidden: true}
                ],
                starterCode: {
                    python: 'def euclidean_distance(point1, point2):\n    # Your code here\n    pass',
                    javascript: 'function euclideanDistance(point1, point2) {\n    // Your code here\n}',
                    java: 'public class Solution {\n    public double euclideanDistance(double[] point1, double[] point2) {\n        // Your code here\n    }\n}'
                },
                functionName: 'euclidean_distance'
            },
        },
        'fullstack-developer': {
            technical: {question: 'Explain how you would optimize a full-stack application for performance.', expectedPoints: ['Frontend optimization', 'Backend optimization', 'Database tuning'], hints: ['Think about caching', 'Consider code splitting']},
            behavioral: {question: 'Tell me about a time you built a feature end-to-end.', expectedPoints: ['Planning', 'Implementation', 'Deployment'], hints: ['Use STAR method']},
            coding: {
                question: 'Implement a function to validate a JSON Web Token (JWT) structure. Check if it has three parts separated by dots and is properly formatted.',
                expectedPoints: ['Split by dot', 'Check three parts', 'Base64 validation'],
                hints: ['JWT format: header.payload.signature', 'Each part should be base64 encoded'],
                testCases: [
                    {input: {token: 'eyJhbGc.eyJ1c2Vy.SflKxwRJ'}, output: true, hidden: false},
                    {input: {token: 'invalid.token'}, output: false, hidden: true}
                ],
                starterCode: {
                    python: 'def validate_jwt_structure(token):\n    # Your code here\n    pass',
                    javascript: 'function validateJwtStructure(token) {\n    // Your code here\n}',
                    java: 'public class Solution {\n    public boolean validateJwtStructure(String token) {\n        // Your code here\n    }\n}'
                },
                functionName: 'validate_jwt_structure'
            },
        },
        'devops': {
            technical: {question: 'Explain CI/CD pipelines and their benefits.', expectedPoints: ['Continuous integration', 'Continuous deployment', 'Automation benefits'], hints: ['Think about testing', 'Consider rollback strategies']},
            behavioral: {question: 'Describe a time you automated a manual process.', expectedPoints: ['Problem identified', 'Solution implemented', 'Time saved'], hints: ['Use STAR method']},
            coding: {
                question: 'Write a function to parse environment variables from a string in KEY=VALUE format. Return a dictionary/map of the variables.',
                expectedPoints: ['Split by newline', 'Split by equals', 'Handle edge cases'],
                hints: ['Split each line by =', 'Handle empty lines and comments'],
                testCases: [
                    {input: {envString: 'PORT=3000\nHOST=localhost'}, output: {PORT: '3000', HOST: 'localhost'}, hidden: false},
                    {input: {envString: 'DB_HOST=db\nDB_PORT=5432\n'}, output: {DB_HOST: 'db', DB_PORT: '5432'}, hidden: true}
                ],
                starterCode: {
                    python: 'def parse_env_vars(env_string):\n    # Your code here\n    pass',
                    javascript: 'function parseEnvVars(envString) {\n    // Your code here\n}',
                    java: 'public class Solution {\n    public Map<String, String> parseEnvVars(String envString) {\n        // Your code here\n    }\n}'
                },
                functionName: 'parse_env_vars'
            },
        },
        'mobile-developer': {
            technical: {question: 'Explain the mobile app lifecycle and state management.', expectedPoints: ['Lifecycle methods', 'State persistence', 'Background tasks'], hints: ['Think about Android/iOS differences', 'Consider memory constraints']},
            behavioral: {question: 'Tell me about a mobile app feature you built.', expectedPoints: ['Platform choice', 'Implementation', 'User feedback'], hints: ['Use STAR method']},
            coding: {
                question: 'Implement a function to calculate the distance a user has scrolled as a percentage. Given scroll position and total scrollable height, return percentage (0-100).',
                expectedPoints: ['Division calculation', 'Percentage conversion', 'Handle edge cases'],
                hints: ['Formula: (scrollPos / totalHeight) * 100', 'Handle divide by zero'],
                testCases: [
                    {input: {scrollPos: 250, totalHeight: 1000}, output: 25.0, hidden: false},
                    {input: {scrollPos: 750, totalHeight: 1000}, output: 75.0, hidden: true}
                ],
                starterCode: {
                    python: 'def scroll_percentage(scroll_pos, total_height):\n    # Your code here\n    pass',
                    javascript: 'function scrollPercentage(scrollPos, totalHeight) {\n    // Your code here\n}',
                    java: 'public class Solution {\n    public double scrollPercentage(int scrollPos, int totalHeight) {\n        // Your code here\n    }\n}'
                },
                functionName: 'scroll_percentage'
            },
        },
    };

    const roleKey=session.role||'frontend-developer';
    const typeKey=session.interviewType||'technical';

    const roleSpecific=roleQuestions[roleKey]?.[typeKey];
    if (roleSpecific)
    {
        const result={
            question: roleSpecific.question,
            type: typeKey,
            expectedPoints: roleSpecific.expectedPoints,
            hints: roleSpecific.hints,
        };
        
        // Include test cases and starter code for coding questions
        if (typeKey==='coding'&&roleSpecific.testCases)
        {
            result.testCases=roleSpecific.testCases;
            result.starterCode=roleSpecific.starterCode;
            result.functionName=roleSpecific.functionName;
        }
        
        return result;
    }

    // Final fallback
    return {
        question: 'Describe your experience and key skills in your field.',
        type: typeKey,
        expectedPoints: ['Relevant experience', 'Technical skills', 'Projects'],
        hints: ['Be specific', 'Use examples'],
    };
}

function getModeQuestionCount(mode)
{
    const counts={quick: 5, real: 12, coding: 3};
    return counts[mode]||5;
}

function calculateTechnicalScore(answers)
{
    if (answers.length===0) return 0;
    return answers.reduce((sum, a) => sum+a.evaluation.score, 0)/answers.length;
}

function calculateCommunicationScore(answers)
{
    // Based on answer length and clarity (simulated)
    if (answers.length===0) return 0;
    const avgLength=answers.reduce((sum, a) => sum+a.answer.length, 0)/answers.length;
    return Math.min(10, (avgLength/100)*10);
}

function calculateProblemSolvingScore(answers)
{
    // Similar to technical but can be adjusted
    return calculateTechnicalScore(answers);
}

function calculateConfidenceScore(answers)
{
    // Simulated based on answer characteristics
    if (answers.length===0) return 0;
    return answers.reduce((sum, a) => sum+(a.evaluation.score>=7? 8:6), 0)/answers.length;
}

export default router;
