import express from 'express';
import {v4 as uuidv4} from 'uuid';

const router=express.Router();

// In-memory storage
const interviews=new Map();

// Create interview
router.post('/create', (req, res) =>
{
    const interview={
        id: uuidv4(),
        mode: req.body.mode||'recruiter', // 'recruiter' or 'practice'
        candidateName: req.body.candidateName||'Anonymous',
        recruiterName: req.body.recruiterName||'AI Interviewer',
        status: 'active',
        startTime: new Date(),
        questions: [],
        codeSubmissions: [],
        proctoringEvents: [],
        notes: '',
    };

    interviews.set(interview.id, interview);
    res.json(interview);
});

// Get interview by ID
router.get('/:id', (req, res) =>
{
    const interview=interviews.get(req.params.id);
    if (!interview)
    {
        return res.status(404).json({error: 'Interview not found'});
    }
    res.json(interview);
});

// Get all interviews
router.get('/', (req, res) =>
{
    res.json(Array.from(interviews.values()));
});

// End interview
router.post('/:id/end', (req, res) =>
{
    const interview=interviews.get(req.params.id);
    if (!interview)
    {
        return res.status(404).json({error: 'Interview not found'});
    }

    interview.status='completed';
    interview.endTime=new Date();
    interview.feedback=req.body.feedback||'';
    interview.rating=req.body.rating||null;

    res.json(interview);
});

// Add question to interview
router.post('/:id/question', (req, res) =>
{
    const interview=interviews.get(req.params.id);
    if (!interview)
    {
        return res.status(404).json({error: 'Interview not found'});
    }

    interview.questions.push(req.body);
    res.json({success: true});
});

// Add code submission
router.post('/:id/submission', (req, res) =>
{
    const interview=interviews.get(req.params.id);
    if (!interview)
    {
        return res.status(404).json({error: 'Interview not found'});
    }

    interview.codeSubmissions.push({
        ...req.body,
        timestamp: new Date(),
    });
    res.json({success: true});
});

export default router;
