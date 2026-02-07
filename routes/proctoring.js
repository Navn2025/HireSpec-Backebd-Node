import express from 'express';

const router=express.Router();

// In-memory storage for proctoring events
const proctoringEvents=new Map();

// In-memory storage for active sessions
const activeSessions=new Map();

// In-memory storage for identity verification results
const identityVerifications=new Map();

// Python auth backend URL for face verification
const AUTH_BACKEND_URL=process.env.AUTH_BACKEND_URL||'http://localhost:5001';

// Verify user identity during interview
router.post('/verify-identity', async (req, res) =>
{
    const {interviewId, userId, image}=req.body;

    if (!userId||!image)
    {
        return res.status(400).json({
            success: false,
            verified: false,
            message: 'Missing userId or image'
        });
    }

    try
    {
        // Call Python backend for face verification
        const response=await fetch(`${AUTH_BACKEND_URL}/api/auth/verify-identity`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: userId,
                image: image,
                strict: true
            })
        });

        const result=await response.json();

        // Store verification result
        if (!identityVerifications.has(interviewId))
        {
            identityVerifications.set(interviewId, []);
        }

        const verificationRecord={
            timestamp: new Date(),
            userId,
            verified: result.verified,
            score: result.score,
            liveness: result.liveness
        };

        identityVerifications.get(interviewId).push(verificationRecord);

        // If verification failed, log as proctoring event
        if (!result.verified)
        {
            if (!proctoringEvents.has(interviewId))
            {
                proctoringEvents.set(interviewId, []);
            }

            proctoringEvents.get(interviewId).push({
                eventType: 'identity_mismatch',
                severity: 'critical',
                details: `Face does not match registered user. Score: ${result.score?.toFixed(3)||'N/A'}`,
                timestamp: new Date()
            });
        }

        res.json({
            success: true,
            verified: result.verified,
            score: result.score,
            liveness: result.liveness,
            reason: result.reason
        });
    } catch (error)
    {
        console.error('Identity verification error:', error);
        res.status(503).json({
            success: false,
            verified: false,
            message: 'Identity verification service unavailable'
        });
    }
});

// Get identity verification history for an interview
router.get('/:interviewId/identity-checks', (req, res) =>
{
    const verifications=identityVerifications.get(req.params.interviewId)||[];
    const passedCount=verifications.filter(v => v.verified).length;
    const failedCount=verifications.filter(v => !v.verified).length;

    res.json({
        total: verifications.length,
        passed: passedCount,
        failed: failedCount,
        verifications
    });
});

// Log proctoring event
router.post('/event', (req, res) =>
{
    const {interviewId, eventType, severity, details}=req.body;

    if (!proctoringEvents.has(interviewId))
    {
        proctoringEvents.set(interviewId, []);
    }

    const event={
        eventType,
        severity,
        details,
        timestamp: new Date(),
    };

    proctoringEvents.get(interviewId).push(event);

    // Update session last activity
    if (activeSessions.has(interviewId))
    {
        const session=activeSessions.get(interviewId);
        session.lastActivity=new Date();
        session.eventCount=(session.eventCount||0)+1;
        activeSessions.set(interviewId, session);
    }

    res.json({success: true, event});
});

// Get events for interview
router.get('/:interviewId', (req, res) =>
{
    const events=proctoringEvents.get(req.params.interviewId)||[];
    res.json(events);
});

// Get integrity score
router.get('/:interviewId/score', (req, res) =>
{
    const events=proctoringEvents.get(req.params.interviewId)||[];

    let score=100;
    const breakdown={};

    events.forEach(event =>
    {
        // Count events
        breakdown[event.eventType]=(breakdown[event.eventType]||0)+1;

        // Deduct points based on severity
        switch (event.severity)
        {
            case 'low':
                score-=2;
                break;
            case 'medium':
                score-=5;
                break;
            case 'high':
                score-=10;
                break;
            case 'critical':
                score-=20;
                break;
        }
    });

    res.json({
        score: Math.max(0, score),
        totalEvents: events.length,
        breakdown,
    });
});

// Register/update active session
router.post('/session', (req, res) =>
{
    const {interviewId, candidateName, candidateEmail, recruiterName, startTime}=req.body;

    activeSessions.set(interviewId, {
        interviewId,
        candidateName,
        candidateEmail,
        recruiterName,
        startTime: startTime||new Date(),
        lastActivity: new Date(),
        status: 'active',
        eventCount: 0,
    });

    res.json({success: true});
});

// End session
router.delete('/session/:interviewId', (req, res) =>
{
    const {interviewId}=req.params;

    if (activeSessions.has(interviewId))
    {
        const session=activeSessions.get(interviewId);
        session.status='completed';
        session.endTime=new Date();
        activeSessions.set(interviewId, session);
    }

    res.json({success: true});
});

// Get all active sessions (for dashboard)
router.get('/dashboard/sessions', (req, res) =>
{
    const sessions=Array.from(activeSessions.values())
        .filter(session => session.status==='active')
        .map(session =>
        {
            const events=proctoringEvents.get(session.interviewId)||[];

            // Calculate integrity score
            let score=100;
            events.forEach(event =>
            {
                switch (event.severity)
                {
                    case 'low':
                        score-=2;
                        break;
                    case 'medium':
                        score-=5;
                        break;
                    case 'high':
                        score-=10;
                        break;
                    case 'critical':
                        score-=20;
                        break;
                }
            });

            // Count violations by severity
            const violations={
                low: events.filter(e => e.severity==='low').length,
                medium: events.filter(e => e.severity==='medium').length,
                high: events.filter(e => e.severity==='high').length,
                critical: events.filter(e => e.severity==='critical').length,
            };

            // Calculate duration
            const duration=Math.floor((new Date()-new Date(session.startTime))/1000/60); // minutes

            return {
                ...session,
                integrityScore: Math.max(0, score),
                violations,
                totalEvents: events.length,
                duration,
                recentEvents: events.slice(-5),
            };
        });

    res.json(sessions);
});

// Get session details for dashboard
router.get('/dashboard/:interviewId', (req, res) =>
{
    const {interviewId}=req.params;
    const session=activeSessions.get(interviewId);

    if (!session)
    {
        return res.status(404).json({error: 'Session not found'});
    }

    const events=proctoringEvents.get(interviewId)||[];

    res.json({
        session,
        events,
        eventCount: events.length,
    });
});

export default router;
