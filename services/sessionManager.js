import {v4 as uuidv4} from 'uuid';

class SessionManager
{
    constructor()
    {
        this.sessions=new Map();
        this.submissions=new Map();
    }

    createSession({userId='anonymous', problemId, timeLimit=null, maxSubmissions=10})
    {
        const sessionId=uuidv4();
        const session={
            sessionId, userId, problemId,
            startTime: Date.now(), endTime: null,
            timeLimit, maxSubmissions,
            status: 'active',
            violations: {tabSwitches: 0, focusLosses: 0, pasteAttempts: 0, devToolsAttempts: 0, rightClickAttempts: 0, fullscreenExits: 0, copyAttempts: 0, suspiciousBehavior: 0},
            metrics: {totalKeystrokes: 0, inactiveTime: 0, averageTypingSpeed: 0, lastActivity: Date.now()},
            submissionCount: 0, submissions: [], warnings: [], flags: []
        };
        this.sessions.set(sessionId, session);
        return session;
    }

    getSession(sessionId) {return this.sessions.get(sessionId);}

    recordViolation(sessionId, violationType, details={})
    {
        const session=this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        if (session.violations.hasOwnProperty(violationType)) session.violations[violationType]++;
        session.warnings.push({type: violationType, timestamp: Date.now(), details});
        const totalViolations=Object.values(session.violations).reduce((sum, count) => sum+count, 0);
        if (totalViolations>20)
        {
            session.flags.push({type: 'excessive_violations', severity: 'critical', timestamp: Date.now(), message: 'Too many violations detected'});
            this.terminateSession(sessionId, 'excessive_violations');
        }
        return session;
    }

    updateMetrics(sessionId, metrics)
    {
        const session=this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        session.metrics={...session.metrics, ...metrics};
        session.metrics.lastActivity=Date.now();
        return session;
    }

    recordSubmission(sessionId, {code, language, result, executionTime})
    {
        const session=this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        if (session.status!=='active') throw new Error(`Session is ${session.status}. Cannot submit.`);
        if (session.submissionCount>=session.maxSubmissions)
        {
            session.flags.push({type: 'submission_limit_exceeded', severity: 'high', timestamp: Date.now()});
            throw new Error('Maximum submissions exceeded');
        }
        if (session.timeLimit)
        {
            if (Date.now()-session.startTime>session.timeLimit)
            {
                this.terminateSession(sessionId, 'time_limit_exceeded');
                throw new Error('Time limit exceeded');
            }
        }
        const submission={
            submissionId: uuidv4(), sessionId, timestamp: Date.now(),
            code, language, codeLength: code.length, result, executionTime,
            timeSinceStart: Date.now()-session.startTime
        };
        session.submissionCount++;
        session.submissions.push(submission);
        this.submissions.set(submission.submissionId, submission);
        this.detectSuspiciousPatterns(session);
        return {session, submission};
    }

    detectSuspiciousPatterns(session)
    {
        const submissions=session.submissions;
        if (submissions.length<2) return;
        const last=submissions[submissions.length-1];
        const prev=submissions[submissions.length-2];
        const timeBetween=last.timestamp-prev.timestamp;
        if (timeBetween<5000) session.flags.push({type: 'rapid_submission', severity: 'medium', timestamp: Date.now(), details: {timeBetween}});
        if (last.code===prev.code) session.flags.push({type: 'duplicate_submission', severity: 'low', timestamp: Date.now()});
        if (prev.result?.hasError&&!last.result?.hasError)
        {
            const codeChangeMagnitude=Math.abs(last.codeLength-prev.codeLength);
            if (codeChangeMagnitude>100&&timeBetween<30000)
            {
                session.flags.push({type: 'sudden_perfect_solution', severity: 'high', timestamp: Date.now(), details: {timeBetween, codeChangeMagnitude}});
                session.violations.suspiciousBehavior++;
            }
        }
    }

    checkSubmissionCooldown(sessionId, cooldownMs=3000)
    {
        const session=this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        if (session.submissions.length===0) return {allowed: true};
        const last=session.submissions[session.submissions.length-1];
        const timeSince=Date.now()-last.timestamp;
        if (timeSince<cooldownMs) return {allowed: false, remainingTime: cooldownMs-timeSince, message: `Please wait ${Math.ceil((cooldownMs-timeSince)/1000)}s before submitting again`};
        return {allowed: true};
    }

    terminateSession(sessionId, reason='manual')
    {
        const session=this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        session.status='terminated';
        session.endTime=Date.now();
        session.terminationReason=reason;
        return session;
    }

    completeSession(sessionId)
    {
        const session=this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        session.status='completed';
        session.endTime=Date.now();
        return session;
    }

    getSessionSummary(sessionId)
    {
        const session=this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        const duration=(session.endTime||Date.now())-session.startTime;
        const totalViolations=Object.values(session.violations).reduce((sum, count) => sum+count, 0);
        const highSeverityFlags=session.flags.filter(f => f.severity==='high'||f.severity==='critical').length;
        return {
            sessionId: session.sessionId, userId: session.userId, problemId: session.problemId,
            duration, status: session.status, submissionCount: session.submissionCount,
            totalViolations, violations: session.violations, highSeverityFlags,
            flags: session.flags, terminationReason: session.terminationReason,
            trustScore: this.calculateTrustScore(session)
        };
    }

    calculateTrustScore(session)
    {
        let score=100;
        score-=session.violations.tabSwitches*3;
        score-=session.violations.focusLosses*2;
        score-=session.violations.pasteAttempts*5;
        score-=session.violations.devToolsAttempts*10;
        score-=session.violations.suspiciousBehavior*15;
        score-=session.flags.filter(f => f.severity==='critical').length*20;
        score-=session.flags.filter(f => f.severity==='high').length*10;
        score-=session.flags.filter(f => f.severity==='medium').length*5;
        return Math.max(0, Math.min(100, score));
    }

    cleanupOldSessions(maxAgeMs=24*60*60*1000)
    {
        const now=Date.now();
        let cleaned=0;
        for (const [sessionId, session] of this.sessions.entries())
        {
            if (now-session.startTime>maxAgeMs&&session.status!=='active') {this.sessions.delete(sessionId); cleaned++;}
        }
        return cleaned;
    }
}

export default new SessionManager();
