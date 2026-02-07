import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// In-memory store for live interview sessions
const liveInterviewSessions = new Map();

// Create a new live interview session
router.post('/create', async (req, res) => {
    try {
        const { 
            recruiterId, 
            recruiterName, 
            companyName, 
            jobTitle,
            candidateEmail,
            candidateName,
            scheduledTime,
            duration = 60, // minutes
            requirements = []
        } = req.body;

        const sessionId = uuidv4();
        const accessCode = generateAccessCode();

        const session = {
            id: sessionId,
            accessCode,
            recruiterId,
            recruiterName,
            companyName,
            jobTitle,
            candidateEmail,
            candidateName,
            scheduledTime: scheduledTime || new Date(),
            duration,
            requirements,
            status: 'scheduled', // scheduled, waiting, in-progress, completed
            participants: [],
            createdAt: new Date(),
            startedAt: null,
            endedAt: null,
            recording: {
                enabled: false,
                url: null
            },
            codeSnapshots: [],
            chatHistory: [],
            proctoringEvents: [],
            feedback: null
        };

        liveInterviewSessions.set(sessionId, session);

        res.json({
            success: true,
            session: {
                id: sessionId,
                accessCode,
                recruiterJoinUrl: `/live-interview/${sessionId}?role=recruiter&code=${accessCode}`,
                candidateJoinUrl: `/live-interview/${sessionId}?role=candidate&code=${accessCode}`
            }
        });
    } catch (error) {
        console.error('Error creating live interview session:', error);
        res.status(500).json({ error: 'Failed to create interview session' });
    }
});

// Get session details
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { code } = req.query;

        const session = liveInterviewSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Verify access code
        if (session.accessCode !== code) {
            return res.status(403).json({ error: 'Invalid access code' });
        }

        res.json({
            success: true,
            session: {
                id: session.id,
                recruiterName: session.recruiterName,
                companyName: session.companyName,
                jobTitle: session.jobTitle,
                candidateName: session.candidateName,
                scheduledTime: session.scheduledTime,
                duration: session.duration,
                status: session.status,
                participants: session.participants,
                requirements: session.requirements
            }
        });
    } catch (error) {
        console.error('Error getting session:', error);
        res.status(500).json({ error: 'Failed to get session' });
    }
});

// Join session
router.post('/join/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { name, role, code } = req.body;

        const session = liveInterviewSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.accessCode !== code) {
            return res.status(403).json({ error: 'Invalid access code' });
        }

        // Add participant
        const participant = {
            id: uuidv4(),
            name,
            role,
            joinedAt: new Date(),
            cameras: {
                primary: null,
                secondary: null
            },
            audioEnabled: true,
            videoEnabled: true
        };

        session.participants.push(participant);

        // Update session status
        if (session.status === 'scheduled') {
            session.status = 'waiting';
        }

        // If both recruiter and candidate are present, start the interview
        const hasRecruiter = session.participants.some(p => p.role === 'recruiter');
        const hasCandidate = session.participants.some(p => p.role === 'candidate');

        if (hasRecruiter && hasCandidate && session.status !== 'in-progress') {
            session.status = 'in-progress';
            session.startedAt = new Date();
        }

        liveInterviewSessions.set(sessionId, session);

        res.json({
            success: true,
            participant,
            session: {
                status: session.status,
                participants: session.participants
            }
        });
    } catch (error) {
        console.error('Error joining session:', error);
        res.status(500).json({ error: 'Failed to join session' });
    }
});

// End session
router.post('/end/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { feedback, notes } = req.body;

        const session = liveInterviewSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        session.status = 'completed';
        session.endedAt = new Date();
        session.feedback = { feedback, notes };

        liveInterviewSessions.set(sessionId, session);

        res.json({
            success: true,
            summary: {
                duration: Math.round((session.endedAt - session.startedAt) / 60000),
                codeSnapshots: session.codeSnapshots.length,
                chatMessages: session.chatHistory.length,
                proctoringEvents: session.proctoringEvents.length
            }
        });
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

// Save code snapshot
router.post('/snapshot/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { code, language, timestamp } = req.body;

        const session = liveInterviewSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        session.codeSnapshots.push({
            code,
            language,
            timestamp: timestamp || new Date()
        });

        liveInterviewSessions.set(sessionId, session);

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving snapshot:', error);
        res.status(500).json({ error: 'Failed to save snapshot' });
    }
});

// Add proctoring event
router.post('/proctoring-event/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { event } = req.body;

        const session = liveInterviewSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        session.proctoringEvents.push({
            ...event,
            timestamp: new Date()
        });

        liveInterviewSessions.set(sessionId, session);

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving proctoring event:', error);
        res.status(500).json({ error: 'Failed to save proctoring event' });
    }
});

// Get all active sessions (for admin/dashboard)
router.get('/active', async (req, res) => {
    try {
        const activeSessions = [];
        
        for (const [id, session] of liveInterviewSessions) {
            if (session.status === 'in-progress' || session.status === 'waiting') {
                activeSessions.push({
                    id: session.id,
                    recruiterName: session.recruiterName,
                    candidateName: session.candidateName,
                    companyName: session.companyName,
                    status: session.status,
                    participants: session.participants.length,
                    startedAt: session.startedAt
                });
            }
        }

        res.json({ success: true, sessions: activeSessions });
    } catch (error) {
        console.error('Error getting active sessions:', error);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

// Helper function to generate access code
function generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export default router;
