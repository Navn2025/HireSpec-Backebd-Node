import express from 'express';
import questionBank from '../services/questionBank.js';
import testRunner from '../services/testRunner.js';

const router = express.Router();

router.get('/filters', async (req, res) => {
    try {
        res.json({ success: true, filters: questionBank.getFilterOptions() });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get filters', message: error.message });
    }
});

router.get('/random', async (req, res) => {
    try {
        const { difficulty, company, topics, domain } = req.query;
        const filters = {};
        if (difficulty) filters.difficulty = difficulty;
        if (company) filters.company = company;
        if (domain) filters.domain = domain;
        if (topics) filters.topics = topics.split(',');
        const question = questionBank.getRandomQuestion(filters);
        if (!question) return res.status(404).json({ success: false, error: 'No questions found' });
        res.json({ success: true, question: questionBank.sanitizeQuestion(question) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get question', message: error.message });
    }
});

router.get('/stats/overview', async (req, res) => {
    try {
        res.json({ success: true, stats: questionBank.getStatistics() });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get statistics', message: error.message });
    }
});

router.get('/progress/:userId', async (req, res) => {
    try {
        res.json({ success: true, progress: questionBank.getUserProgress(req.params.userId) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get progress', message: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const { difficulty, company, topics, domain } = req.query;
        const filters = {};
        if (difficulty) filters.difficulty = difficulty;
        if (company) filters.company = company;
        if (domain) filters.domain = domain;
        if (topics) filters.topics = topics.split(',');
        const questions = questionBank.getAllQuestions(filters);
        res.json({ success: true, count: questions.length, questions: questions.map(q => ({ id: q.id, title: q.title, difficulty: q.difficulty, domain: q.domain, topics: q.topics, companies: q.companies })) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get questions', message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const question = questionBank.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
        res.json({ success: true, question: questionBank.sanitizeQuestion(question) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get question', message: error.message });
    }
});

router.post('/run-tests', async (req, res) => {
    try {
        const { questionId, language, code } = req.body;
        if (!questionId || !language || !code) return res.status(400).json({ success: false, error: 'Missing required fields' });
        const question = questionBank.getQuestionById(questionId);
        if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
        if (!question.testCases || question.testCases.length === 0) return res.status(400).json({ success: false, error: 'No test cases available' });
        const testResults = await testRunner.runTests(code, language, question.testCases, question.functionName);
        res.json({
            success: true,
            results: {
                allPassed: testResults.allPassed, totalTests: testResults.totalTests,
                passedTests: testResults.passedTests, failedTests: testResults.failedTests,
                hiddenPassed: testResults.hiddenPassed, hiddenTotal: testResults.hiddenTotal,
                visibleTests: testResults.testResults.filter(t => !t.hidden), error: testResults.error
            }
        });
    } catch (error) {
        console.error('Run tests error:', error);
        res.status(500).json({ success: false, error: 'Failed to run tests', message: error.message });
    }
});

router.post('/submit', async (req, res) => {
    try {
        const { userId, questionId, language, code } = req.body;
        if (!userId || !questionId || !language || !code) return res.status(400).json({ success: false, error: 'Missing required fields' });
        const question = questionBank.getQuestionById(questionId);
        if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
        const testResults = await testRunner.runTests(code, language, question.testCases, question.functionName);
        const solved = testResults.allPassed;
        const userProgress = questionBank.markQuestionSolved(userId, questionId, language, code, { allPassed: testResults.allPassed, passedTests: testResults.passedTests, totalTests: testResults.totalTests });
        res.json({
            success: true,
            message: solved ? 'Accepted! All test cases passed.' : 'Wrong Answer. Some test cases failed.',
            solved,
            results: {
                allPassed: testResults.allPassed, totalTests: testResults.totalTests,
                passedTests: testResults.passedTests, failedTests: testResults.failedTests,
                hiddenPassed: testResults.hiddenPassed, hiddenTotal: testResults.hiddenTotal,
                visibleTests: testResults.testResults.filter(t => !t.hidden)
            },
            progress: userProgress
        });
    } catch (error) {
        console.error('Submit solution error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit solution', message: error.message });
    }
});

export default router;
