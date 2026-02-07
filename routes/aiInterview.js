import express from 'express';
import {v4 as uuidv4} from 'uuid';
import aiInterviewer from '../services/aiInterviewer.js';

const router=express.Router();

// In-memory storage for AI interview sessions
const aiInterviewSessions=new Map();

// Available job roles
router.get('/roles', (req, res) =>
{
    const roles=[
        'Frontend Developer',
        'Backend Developer',
        'Full Stack Developer',
        'Data Scientist',
        'DevOps Engineer'
    ];
    res.json({roles});
});

// Start new AI interview session
router.post('/start', async (req, res) =>
{
    try
    {
        const {candidateName, role, questionCount=5, useAI=true, difficulty='Mixed'}=req.body;

        if (!candidateName||!role)
        {
            return res.status(400).json({
                error: 'candidateName and role are required'
            });
        }

        // Create session
        const sessionId=uuidv4();

        // Use AI to generate questions or fallback to static questions
        let questions;
        if (useAI)
        {
            console.log(`🤖 Generating AI questions for ${role}...`);
            questions=await aiInterviewer.generateAIQuestions(role, questionCount, difficulty);
        } else
        {
            questions=aiInterviewer.getQuestionsForRole(role, questionCount);
        }

        const greeting=aiInterviewer.generateGreeting(candidateName, role);

        const session={
            sessionId,
            candidateName,
            role,
            status: 'active',
            startTime: new Date(),
            currentQuestionIndex: 0,
            questions,
            questionAnswerPairs: [],
            greeting,
            totalQuestions: questions.length,
            useAI
        };

        aiInterviewSessions.set(sessionId, session);

        console.log(`✅ Interview started for ${candidateName} - ${role} (${questions.length} questions)`);

        res.json({
            sessionId,
            greeting,
            totalQuestions: questions.length,
            firstQuestion: questions[0]?.question,
            questionMetadata: {
                id: questions[0]?.id,
                topic: questions[0]?.topic,
                difficulty: questions[0]?.difficulty,
                number: 1,
                total: questions.length
            }
        });
    } catch (error)
    {
        console.error('Error starting AI interview:', error);
        res.status(500).json({error: 'Failed to start interview', details: error.message});
    }
});

// Submit answer and get next question or follow-up
router.post('/answer', async (req, res) =>
{
    try
    {
        const {sessionId, answer, audioMetrics={}}=req.body;

        if (!sessionId||!answer)
        {
            return res.status(400).json({
                error: 'sessionId and answer are required'
            });
        }

        const session=aiInterviewSessions.get(sessionId);
        if (!session)
        {
            return res.status(404).json({error: 'Session not found'});
        }

        if (session.status!=='active')
        {
            return res.status(400).json({error: 'Session is not active'});
        }

        // Get current question
        const currentQuestion=session.questions[session.currentQuestionIndex];

        // Evaluate the answer
        const evaluation=await aiInterviewer.evaluateAnswer({
            question: currentQuestion.question,
            answer,
            role: session.role,
            audioMetrics
        });

        // Store question-answer pair with evaluation
        const qaData={
            question: currentQuestion.question,
            questionMetadata: currentQuestion,
            answer,
            evaluation,
            timestamp: new Date(),
            followUps: []
        };

        session.questionAnswerPairs.push(qaData);

        // Decide: generate follow-up or move to next question
        const shouldGenerateFollowUp=
            evaluation.overallScore<70|| // Needs clarification
            answer.length<50|| // Short answer
            Math.random()>0.5; // Random follow-up

        let response={
            evaluation: {
                overallScore: evaluation.overallScore,
                feedback: evaluation.detailedFeedback
            },
            questionNumber: session.currentQuestionIndex+1,
            totalQuestions: session.totalQuestions
        };

        if (shouldGenerateFollowUp&&!session.hasFollowUp)
        {
            // Generate follow-up question
            const followUp=await aiInterviewer.generateFollowUpQuestion(
                currentQuestion.question,
                answer,
                session.role,
                sessionId
            );

            session.hasFollowUp=true;
            qaData.followUps.push({question: followUp, answer: null});

            response.hasFollowUp=true;
            response.followUpQuestion=followUp;
            response.message="That's interesting. Let me ask a follow-up question:";
        } else
        {
            // Move to next question
            session.hasFollowUp=false;
            session.currentQuestionIndex++;

            if (session.currentQuestionIndex<session.questions.length)
            {
                const nextQuestion=session.questions[session.currentQuestionIndex];
                response.nextQuestion=nextQuestion.question;
                response.questionMetadata={
                    id: nextQuestion.id,
                    topic: nextQuestion.topic,
                    difficulty: nextQuestion.difficulty,
                    number: session.currentQuestionIndex+1,
                    total: session.totalQuestions
                };
                response.message="Great! Moving to the next question:";
            } else
            {
                // Interview complete
                session.status='completed';
                session.endTime=new Date();
                response.interviewComplete=true;
                response.message="That concludes our interview. Generating your report now...";
            }
        }

        aiInterviewSessions.set(sessionId, session);
        res.json(response);

    } catch (error)
    {
        console.error('Error processing answer:', error);
        res.status(500).json({error: 'Failed to process answer'});
    }
});

// Submit follow-up answer
router.post('/follow-up-answer', async (req, res) =>
{
    try
    {
        const {sessionId, answer}=req.body;

        if (!sessionId||!answer)
        {
            return res.status(400).json({
                error: 'sessionId and answer are required'
            });
        }

        const session=aiInterviewSessions.get(sessionId);
        if (!session)
        {
            return res.status(404).json({error: 'Session not found'});
        }

        // Add follow-up answer to the last question-answer pair
        const lastQA=session.questionAnswerPairs[session.questionAnswerPairs.length-1];
        if (lastQA.followUps.length>0)
        {
            lastQA.followUps[lastQA.followUps.length-1].answer=answer;
        }

        // Move to next question
        session.hasFollowUp=false;
        session.currentQuestionIndex++;

        let response={
            questionNumber: session.currentQuestionIndex+1,
            totalQuestions: session.totalQuestions
        };

        if (session.currentQuestionIndex<session.questions.length)
        {
            const nextQuestion=session.questions[session.currentQuestionIndex];
            response.nextQuestion=nextQuestion.question;
            response.questionMetadata={
                id: nextQuestion.id,
                topic: nextQuestion.topic,
                difficulty: nextQuestion.difficulty,
                number: session.currentQuestionIndex+1,
                total: session.totalQuestions
            };
            response.message="Thank you. Let's move on:";
        } else
        {
            // Interview complete
            session.status='completed';
            session.endTime=new Date();
            response.interviewComplete=true;
            response.message="That concludes our interview. Generating your report now...";
        }

        aiInterviewSessions.set(sessionId, session);
        res.json(response);

    } catch (error)
    {
        console.error('Error processing follow-up:', error);
        res.status(500).json({error: 'Failed to process follow-up answer'});
    }
});

// Generate final report
router.post('/report', async (req, res) =>
{
    try
    {
        const {sessionId}=req.body;

        if (!sessionId)
        {
            return res.status(400).json({error: 'sessionId is required'});
        }

        const session=aiInterviewSessions.get(sessionId);
        if (!session)
        {
            return res.status(404).json({error: 'Session not found'});
        }

        // Calculate duration
        const duration=Math.round(
            (new Date(session.endTime||new Date())-new Date(session.startTime))/60000
        );

        // Generate comprehensive report
        const report=await aiInterviewer.generateFinalReport({
            candidateName: session.candidateName,
            role: session.role,
            questionAnswerPairs: session.questionAnswerPairs,
            duration,
            sessionId
        });

        // Store report in session
        session.report=report;
        aiInterviewSessions.set(sessionId, session);

        res.json(report);

    } catch (error)
    {
        console.error('Error generating report:', error);
        res.status(500).json({error: 'Failed to generate report'});
    }
});

// Get session details
router.get('/session/:sessionId', (req, res) =>
{
    const {sessionId}=req.params;
    const session=aiInterviewSessions.get(sessionId);

    if (!session)
    {
        return res.status(404).json({error: 'Session not found'});
    }

    res.json({
        sessionId: session.sessionId,
        candidateName: session.candidateName,
        role: session.role,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        questionsAnswered: session.questionAnswerPairs.length
    });
});

// Get all sessions (for recruiter dashboard)
router.get('/sessions', (req, res) =>
{
    const {status, role}=req.query;

    let sessions=Array.from(aiInterviewSessions.values());

    // Filter by status
    if (status)
    {
        sessions=sessions.filter(s => s.status===status);
    }

    // Filter by role
    if (role)
    {
        sessions=sessions.filter(s => s.role===role);
    }

    // Return summary data
    const sessionSummaries=sessions.map(s => ({
        sessionId: s.sessionId,
        candidateName: s.candidateName,
        role: s.role,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        totalQuestions: s.totalQuestions,
        questionsAnswered: s.questionAnswerPairs.length,
        overallScore: s.report?.scores?.overall||null,
        recommendation: s.report?.recommendation?.recommendation||null
    }));

    res.json({sessions: sessionSummaries, total: sessionSummaries.length});
});

// Get detailed report for a session
router.get('/report/:sessionId', (req, res) =>
{
    const {sessionId}=req.params;
    const session=aiInterviewSessions.get(sessionId);

    if (!session)
    {
        return res.status(404).json({error: 'Session not found'});
    }

    if (!session.report)
    {
        return res.status(404).json({error: 'Report not generated yet'});
    }

    res.json(session.report);
});

// End interview early
router.post('/end/:sessionId', (req, res) =>
{
    const {sessionId}=req.params;
    const session=aiInterviewSessions.get(sessionId);

    if (!session)
    {
        return res.status(404).json({error: 'Session not found'});
    }

    session.status='ended';
    session.endTime=new Date();
    aiInterviewSessions.set(sessionId, session);

    res.json({message: 'Interview ended', sessionId});
});

export default router;
