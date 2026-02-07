import express from 'express';

const router=express.Router();

// Execute code with test cases (for practice mode)
router.post('/execute', async (req, res) =>
{
    const {code, language, testCases}=req.body;

    try
    {
        // If no test cases provided, just execute code
        if (!testCases||testCases.length===0)
        {
            // Mock execution
            return res.json({
                success: true,
                output: 'Code executed successfully!\nHello, World!\n',
                executionTime: '0.12s',
                memory: '15.2 MB',
                status: 'Accepted',
            });
        }

        // Run code against test cases
        // This is a simplified mock - in production, use Judge0 API or similar
        const results=[];
        let passedCount=0;

        for (let i=0;i<testCases.length;i++)
        {
            const testCase=testCases[i];

            // Mock test execution
            // In a real implementation, you would:
            // 1. Create a secure sandbox environment
            // 2. Execute the code with test case inputs
            // 3. Compare outputs
            // 4. Handle timeouts and errors

            const passed=Math.random()>0.3; // Mock: 70% pass rate
            if (passed) passedCount++;

            results.push({
                testCase: i+1,
                passed: passed,
                expected: JSON.stringify(testCase.output),
                actual: passed? JSON.stringify(testCase.output):JSON.stringify('incorrect output'),
                runtime: `${(Math.random()*0.05).toFixed(3)}s`,
                hidden: testCase.hidden||false
            });
        }

        res.json({
            success: true,
            passed: passedCount,
            total: testCases.length,
            details: results.filter(r => !r.hidden), // Only show non-hidden results
            executionTime: `${(Math.random()*0.2).toFixed(2)}s`,
            memory: `${(15+Math.random()*10).toFixed(1)} MB`,
        });

    } catch (error)
    {
        console.error('Code execution error:', error);
        res.json({
            success: false,
            error: error.message||'Code execution failed',
        });
    }
});

// Submit code with test cases
router.post('/submit', async (req, res) =>
{
    const {code, language, questionId}=req.body;

    // Mock submission results
    res.json({
        success: true,
        passed: 3,
        total: 5,
        results: [
            {testCase: 1, passed: true, expected: '[0,1]', actual: '[0,1]', runtime: '0.02s'},
            {testCase: 2, passed: true, expected: '[1,2]', actual: '[1,2]', runtime: '0.01s'},
            {testCase: 3, passed: true, expected: '[0,1]', actual: '[0,1]', runtime: '0.02s'},
            {testCase: 4, passed: false, expected: '[2,3]', actual: '[1,3]', runtime: '0.03s'},
            {testCase: 5, passed: false, expected: '[0,2]', actual: '[0,1]', runtime: '0.02s'},
        ],
        executionTime: '0.15s',
        memory: '16.5 MB',
    });
});

export default router;
