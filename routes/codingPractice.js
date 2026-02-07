import express from 'express';
import axios from 'axios';

const router = express.Router();

// ── Problem bank with curated coding problems ──
const problemBank = {
    easy: [
        {
            id: 'e1',
            title: 'Two Sum',
            difficulty: 'easy',
            category: 'arrays',
            description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
            examples: [
                { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
                { input: 'nums = [3,2,4], target = 6', output: '[1,2]', explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2].' }
            ],
            constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', '-10^9 <= target <= 10^9', 'Only one valid answer exists.'],
            hints: ['Use a hash map to store complements.', 'For each number, check if target - number exists in the map.'],
            starterCode: {
                python: 'def twoSum(nums, target):\n    # Write your solution here\n    pass',
                javascript: 'function twoSum(nums, target) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}',
                cpp: '#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your solution here\n    return {};\n}'
            },
            testCases: [
                { input: { nums: [2, 7, 11, 15], target: 9 }, output: [0, 1], hidden: false },
                { input: { nums: [3, 2, 4], target: 6 }, output: [1, 2], hidden: false },
                { input: { nums: [3, 3], target: 6 }, output: [0, 1], hidden: true }
            ],
            tags: ['arrays', 'hash-table'],
            timeLimit: 15
        },
        {
            id: 'e2',
            title: 'Palindrome Number',
            difficulty: 'easy',
            category: 'math',
            description: 'Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise.\n\nAn integer is a palindrome when it reads the same forward and backward.',
            examples: [
                { input: 'x = 121', output: 'true', explanation: '121 reads as 121 from left to right and from right to left.' },
                { input: 'x = -121', output: 'false', explanation: 'From left to right, it reads -121. From right to left it becomes 121-.' }
            ],
            constraints: ['-2^31 <= x <= 2^31 - 1'],
            hints: ['Could you convert the number to a string?', 'Try reversing half of the number.'],
            starterCode: {
                python: 'def isPalindrome(x):\n    # Write your solution here\n    pass',
                javascript: 'function isPalindrome(x) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public boolean isPalindrome(int x) {\n        // Write your solution here\n        return false;\n    }\n}',
                cpp: 'bool isPalindrome(int x) {\n    // Write your solution here\n    return false;\n}'
            },
            testCases: [
                { input: { x: 121 }, output: true, hidden: false },
                { input: { x: -121 }, output: false, hidden: false },
                { input: { x: 10 }, output: false, hidden: true }
            ],
            tags: ['math'],
            timeLimit: 10
        },
        {
            id: 'e3',
            title: 'Valid Parentheses',
            difficulty: 'easy',
            category: 'stacks',
            description: 'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
            examples: [
                { input: 's = "()"', output: 'true', explanation: 'Simple pair of parentheses.' },
                { input: 's = "()[]{}"', output: 'true', explanation: 'All brackets properly matched.' },
                { input: 's = "(]"', output: 'false', explanation: 'Mismatched brackets.' }
            ],
            constraints: ['1 <= s.length <= 10^4', 's consists of parentheses only \'()[]{}\''],
            hints: ['Use a stack data structure.', 'When you encounter a closing bracket, check if the top of the stack matches.'],
            starterCode: {
                python: 'def isValid(s):\n    # Write your solution here\n    pass',
                javascript: 'function isValid(s) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public boolean isValid(String s) {\n        // Write your solution here\n        return false;\n    }\n}',
                cpp: '#include <string>\nusing namespace std;\n\nbool isValid(string s) {\n    // Write your solution here\n    return false;\n}'
            },
            testCases: [
                { input: { s: '()' }, output: true, hidden: false },
                { input: { s: '()[]{}' }, output: true, hidden: false },
                { input: { s: '(]' }, output: false, hidden: false },
                { input: { s: '([)]' }, output: false, hidden: true }
            ],
            tags: ['stacks', 'strings'],
            timeLimit: 10
        },
        {
            id: 'e4',
            title: 'Reverse String',
            difficulty: 'easy',
            category: 'strings',
            description: 'Write a function that reverses a string. The input string is given as an array of characters `s`.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.',
            examples: [
                { input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]', explanation: 'The array is reversed in place.' },
                { input: 's = ["H","a","n","n","a","h"]', output: '["h","a","n","n","a","H"]', explanation: 'The array is reversed in place.' }
            ],
            constraints: ['1 <= s.length <= 10^5', 's[i] is a printable ascii character.'],
            hints: ['Use two pointers, one at the start and one at the end.', 'Swap characters and move pointers toward the center.'],
            starterCode: {
                python: 'def reverseString(s):\n    # Modify s in-place\n    pass',
                javascript: 'function reverseString(s) {\n    // Modify s in-place\n}',
                java: 'class Solution {\n    public void reverseString(char[] s) {\n        // Modify s in-place\n    }\n}',
                cpp: '#include <vector>\nusing namespace std;\n\nvoid reverseString(vector<char>& s) {\n    // Modify s in-place\n}'
            },
            testCases: [
                { input: { s: ['h', 'e', 'l', 'l', 'o'] }, output: ['o', 'l', 'l', 'e', 'h'], hidden: false },
                { input: { s: ['H', 'a', 'n', 'n', 'a', 'h'] }, output: ['h', 'a', 'n', 'n', 'a', 'H'], hidden: false }
            ],
            tags: ['two-pointers', 'strings'],
            timeLimit: 10
        }
    ],
    medium: [
        {
            id: 'm1',
            title: 'Longest Substring Without Repeating Characters',
            difficulty: 'medium',
            category: 'strings',
            description: 'Given a string `s`, find the length of the longest substring without repeating characters.',
            examples: [
                { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with the length of 3.' },
                { input: 's = "bbbbb"', output: '1', explanation: 'The answer is "b", with the length of 1.' },
                { input: 's = "pwwkew"', output: '3', explanation: 'The answer is "wke", with the length of 3.' }
            ],
            constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols and spaces.'],
            hints: ['Use sliding window technique.', 'Keep a set to track characters in the current window.'],
            starterCode: {
                python: 'def lengthOfLongestSubstring(s):\n    # Write your solution here\n    pass',
                javascript: 'function lengthOfLongestSubstring(s) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your solution here\n        return 0;\n    }\n}',
                cpp: '#include <string>\nusing namespace std;\n\nint lengthOfLongestSubstring(string s) {\n    // Write your solution here\n    return 0;\n}'
            },
            testCases: [
                { input: { s: 'abcabcbb' }, output: 3, hidden: false },
                { input: { s: 'bbbbb' }, output: 1, hidden: false },
                { input: { s: 'pwwkew' }, output: 3, hidden: false },
                { input: { s: '' }, output: 0, hidden: true }
            ],
            tags: ['sliding-window', 'hash-table', 'strings'],
            timeLimit: 20
        },
        {
            id: 'm2',
            title: 'Container With Most Water',
            difficulty: 'medium',
            category: 'arrays',
            description: 'You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i`th line are `(i, 0)` and `(i, height[i])`.\n\nFind two lines that together with the x-axis form a container, such that the container contains the most water.\n\nReturn the maximum amount of water a container can store.',
            examples: [
                { input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49', explanation: 'The max area is between index 1 (height 8) and index 8 (height 7), area = min(8,7) * (8-1) = 49.' },
                { input: 'height = [1,1]', output: '1', explanation: 'The max area is between the two lines, area = 1.' }
            ],
            constraints: ['n == height.length', '2 <= n <= 10^5', '0 <= height[i] <= 10^4'],
            hints: ['Start with two pointers at the beginning and end.', 'Move the pointer with smaller height inward.'],
            starterCode: {
                python: 'def maxArea(height):\n    # Write your solution here\n    pass',
                javascript: 'function maxArea(height) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public int maxArea(int[] height) {\n        // Write your solution here\n        return 0;\n    }\n}',
                cpp: '#include <vector>\nusing namespace std;\n\nint maxArea(vector<int>& height) {\n    // Write your solution here\n    return 0;\n}'
            },
            testCases: [
                { input: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] }, output: 49, hidden: false },
                { input: { height: [1, 1] }, output: 1, hidden: false },
                { input: { height: [4, 3, 2, 1, 4] }, output: 16, hidden: true }
            ],
            tags: ['two-pointers', 'greedy', 'arrays'],
            timeLimit: 20
        },
        {
            id: 'm3',
            title: 'Group Anagrams',
            difficulty: 'medium',
            category: 'strings',
            description: 'Given an array of strings `strs`, group the anagrams together. You can return the answer in any order.\n\nAn anagram is a word or phrase formed by rearranging the letters of a different word or phrase, using all the original letters exactly once.',
            examples: [
                { input: 'strs = ["eat","tea","tan","ate","nat","bat"]', output: '[["bat"],["nat","tan"],["ate","eat","tea"]]', explanation: 'Words are grouped by their sorted characters.' },
                { input: 'strs = [""]', output: '[[""]]', explanation: 'Empty string forms its own group.' }
            ],
            constraints: ['1 <= strs.length <= 10^4', '0 <= strs[i].length <= 100', 'strs[i] consists of lowercase English letters.'],
            hints: ['Sort each string and use it as a key in a hash map.', 'Alternatively, use character frequency as the key.'],
            starterCode: {
                python: 'def groupAnagrams(strs):\n    # Write your solution here\n    pass',
                javascript: 'function groupAnagrams(strs) {\n    // Write your solution here\n}',
                java: 'import java.util.*;\n\nclass Solution {\n    public List<List<String>> groupAnagrams(String[] strs) {\n        // Write your solution here\n        return new ArrayList<>();\n    }\n}',
                cpp: '#include <vector>\n#include <string>\nusing namespace std;\n\nvector<vector<string>> groupAnagrams(vector<string>& strs) {\n    // Write your solution here\n    return {};\n}'
            },
            testCases: [
                { input: { strs: ['eat', 'tea', 'tan', 'ate', 'nat', 'bat'] }, output: [['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']], hidden: false },
                { input: { strs: [''] }, output: [['']], hidden: false },
                { input: { strs: ['a'] }, output: [['a']], hidden: true }
            ],
            tags: ['hash-table', 'strings', 'sorting'],
            timeLimit: 20
        },
        {
            id: 'm4',
            title: 'Binary Search',
            difficulty: 'medium',
            category: 'binary-search',
            description: 'Given a sorted array of distinct integers `nums` and a target value `target`, return the index if the target is found. If not, return the index where it would be inserted in order.\n\nYou must write an algorithm with O(log n) runtime complexity.',
            examples: [
                { input: 'nums = [1,3,5,6], target = 5', output: '2', explanation: '5 is found at index 2.' },
                { input: 'nums = [1,3,5,6], target = 2', output: '1', explanation: '2 would be inserted at index 1.' },
                { input: 'nums = [1,3,5,6], target = 7', output: '4', explanation: '7 would be inserted at index 4.' }
            ],
            constraints: ['1 <= nums.length <= 10^4', '-10^4 <= nums[i] <= 10^4', 'nums contains distinct values sorted in ascending order.'],
            hints: ['Use binary search with left and right pointers.', 'When target not found, the left pointer gives the insertion position.'],
            starterCode: {
                python: 'def searchInsert(nums, target):\n    # Write your solution here\n    pass',
                javascript: 'function searchInsert(nums, target) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public int searchInsert(int[] nums, int target) {\n        // Write your solution here\n        return 0;\n    }\n}',
                cpp: '#include <vector>\nusing namespace std;\n\nint searchInsert(vector<int>& nums, int target) {\n    // Write your solution here\n    return 0;\n}'
            },
            testCases: [
                { input: { nums: [1, 3, 5, 6], target: 5 }, output: 2, hidden: false },
                { input: { nums: [1, 3, 5, 6], target: 2 }, output: 1, hidden: false },
                { input: { nums: [1, 3, 5, 6], target: 7 }, output: 4, hidden: false },
                { input: { nums: [1], target: 0 }, output: 0, hidden: true }
            ],
            tags: ['binary-search', 'arrays'],
            timeLimit: 15
        }
    ],
    hard: [
        {
            id: 'h1',
            title: 'Merge K Sorted Lists',
            difficulty: 'hard',
            category: 'linked-lists',
            description: 'You are given an array of `k` linked-lists, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.',
            examples: [
                { input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]', explanation: 'All lists merged into one sorted list.' },
                { input: 'lists = []', output: '[]', explanation: 'No lists to merge.' }
            ],
            constraints: ['k == lists.length', '0 <= k <= 10^4', '0 <= lists[i].length <= 500', '-10^4 <= lists[i][j] <= 10^4'],
            hints: ['Use a min-heap (priority queue).', 'Divide and conquer: merge lists in pairs.'],
            starterCode: {
                python: 'import heapq\n\ndef mergeKLists(lists):\n    # lists is a list of sorted lists\n    # Return one sorted merged list\n    pass',
                javascript: 'function mergeKLists(lists) {\n    // lists is an array of sorted arrays\n    // Return one sorted merged array\n}',
                java: 'import java.util.*;\n\nclass Solution {\n    public int[] mergeKLists(int[][] lists) {\n        // Return one sorted merged array\n        return new int[]{};\n    }\n}',
                cpp: '#include <vector>\n#include <queue>\nusing namespace std;\n\nvector<int> mergeKLists(vector<vector<int>>& lists) {\n    // Return one sorted merged vector\n    return {};\n}'
            },
            testCases: [
                { input: { lists: [[1, 4, 5], [1, 3, 4], [2, 6]] }, output: [1, 1, 2, 3, 4, 4, 5, 6], hidden: false },
                { input: { lists: [] }, output: [], hidden: false },
                { input: { lists: [[]] }, output: [], hidden: true }
            ],
            tags: ['heap', 'linked-list', 'divide-and-conquer'],
            timeLimit: 30
        },
        {
            id: 'h2',
            title: 'Trapping Rain Water',
            difficulty: 'hard',
            category: 'arrays',
            description: 'Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
            examples: [
                { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6', explanation: '6 units of rain water are trapped.' },
                { input: 'height = [4,2,0,3,2,5]', output: '9', explanation: '9 units of rain water are trapped.' }
            ],
            constraints: ['n == height.length', '1 <= n <= 2 * 10^4', '0 <= height[i] <= 10^5'],
            hints: ['For each element, the water level is min(maxLeft, maxRight) - height.', 'Try using two pointers from both ends.'],
            starterCode: {
                python: 'def trap(height):\n    # Write your solution here\n    pass',
                javascript: 'function trap(height) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public int trap(int[] height) {\n        // Write your solution here\n        return 0;\n    }\n}',
                cpp: '#include <vector>\nusing namespace std;\n\nint trap(vector<int>& height) {\n    // Write your solution here\n    return 0;\n}'
            },
            testCases: [
                { input: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }, output: 6, hidden: false },
                { input: { height: [4, 2, 0, 3, 2, 5] }, output: 9, hidden: false },
                { input: { height: [2, 0, 2] }, output: 2, hidden: true }
            ],
            tags: ['two-pointers', 'dynamic-programming', 'stacks'],
            timeLimit: 25
        },
        {
            id: 'h3',
            title: 'Longest Valid Parentheses',
            difficulty: 'hard',
            category: 'dynamic-programming',
            description: 'Given a string containing just the characters `(` and `)`, return the length of the longest valid (well-formed) parentheses substring.',
            examples: [
                { input: 's = "(()"', output: '2', explanation: 'The longest valid parentheses substring is "()".' },
                { input: 's = ")()())"', output: '4', explanation: 'The longest valid parentheses substring is "()()".' },
                { input: 's = ""', output: '0', explanation: 'Empty string.' }
            ],
            constraints: ['0 <= s.length <= 3 * 10^4', 's[i] is \'(\' or \')\''],
            hints: ['Use a stack to track indices of unmatched parentheses.', 'Dynamic programming: dp[i] = length of longest valid ending at i.'],
            starterCode: {
                python: 'def longestValidParentheses(s):\n    # Write your solution here\n    pass',
                javascript: 'function longestValidParentheses(s) {\n    // Write your solution here\n}',
                java: 'class Solution {\n    public int longestValidParentheses(String s) {\n        // Write your solution here\n        return 0;\n    }\n}',
                cpp: '#include <string>\nusing namespace std;\n\nint longestValidParentheses(string s) {\n    // Write your solution here\n    return 0;\n}'
            },
            testCases: [
                { input: { s: '(()' }, output: 2, hidden: false },
                { input: { s: ')()())' }, output: 4, hidden: false },
                { input: { s: '' }, output: 0, hidden: false },
                { input: { s: '()(()' }, output: 2, hidden: true }
            ],
            tags: ['dynamic-programming', 'stacks', 'strings'],
            timeLimit: 25
        }
    ]
};

// Get all categories from problem bank
function getAllCategories() {
    const cats = new Set();
    Object.values(problemBank).forEach(problems => {
        problems.forEach(p => cats.add(p.category));
    });
    return [...cats];
}

// ── GET /problems – list all problems (metadata only) ──
router.get('/problems', (req, res) => {
    const { difficulty, category } = req.query;
    let problems = [];

    const difficulties = difficulty ? [difficulty] : ['easy', 'medium', 'hard'];
    difficulties.forEach(d => {
        if (problemBank[d]) {
            problemBank[d].forEach(p => {
                if (!category || p.category === category) {
                    problems.push({
                        id: p.id,
                        title: p.title,
                        difficulty: p.difficulty,
                        category: p.category,
                        tags: p.tags,
                        timeLimit: p.timeLimit
                    });
                }
            });
        }
    });

    res.json({
        problems,
        categories: getAllCategories(),
        total: problems.length
    });
});

// ── GET /problems/:id – get full problem details ──
router.get('/problems/:id', (req, res) => {
    const { id } = req.params;
    let problem = null;

    for (const difficulty of ['easy', 'medium', 'hard']) {
        problem = problemBank[difficulty]?.find(p => p.id === id);
        if (problem) break;
    }

    if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
    }

    // Return problem with only visible test cases
    const visibleTestCases = problem.testCases.filter(tc => !tc.hidden);
    res.json({
        ...problem,
        testCases: visibleTestCases,
        totalTestCases: problem.testCases.length,
        hiddenTestCases: problem.testCases.length - visibleTestCases.length
    });
});

// ── POST /problems/:id/run – run code against visible test cases ──
router.post('/problems/:id/run', async (req, res) => {
    const { id } = req.params;
    const { code, language } = req.body;

    let problem = null;
    for (const difficulty of ['easy', 'medium', 'hard']) {
        problem = problemBank[difficulty]?.find(p => p.id === id);
        if (problem) break;
    }

    if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
    }

    try {
        const visibleTests = problem.testCases.filter(tc => !tc.hidden);
        const results = [];
        let passed = 0;

        for (let i = 0; i < visibleTests.length; i++) {
            const tc = visibleTests[i];
            // Mock execution – in production, send to Judge0 or similar sandbox
            const mockPassed = Math.random() > 0.3;
            if (mockPassed) passed++;

            results.push({
                testCase: i + 1,
                passed: mockPassed,
                input: JSON.stringify(tc.input),
                expected: JSON.stringify(tc.output),
                actual: mockPassed ? JSON.stringify(tc.output) : '"wrong answer"',
                runtime: `${(Math.random() * 50).toFixed(0)}ms`
            });
        }

        res.json({
            success: true,
            passed,
            total: visibleTests.length,
            results,
            executionTime: `${(Math.random() * 100).toFixed(0)}ms`,
            memory: `${(10 + Math.random() * 20).toFixed(1)} MB`
        });
    } catch (error) {
        console.error('Run error:', error);
        res.json({ success: false, error: error.message });
    }
});

// ── POST /problems/:id/submit – run code against ALL test cases including hidden ──
router.post('/problems/:id/submit', async (req, res) => {
    const { id } = req.params;
    const { code, language } = req.body;

    let problem = null;
    for (const difficulty of ['easy', 'medium', 'hard']) {
        problem = problemBank[difficulty]?.find(p => p.id === id);
        if (problem) break;
    }

    if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
    }

    try {
        const results = [];
        let passed = 0;

        for (let i = 0; i < problem.testCases.length; i++) {
            const tc = problem.testCases[i];
            const mockPassed = Math.random() > 0.25;
            if (mockPassed) passed++;

            results.push({
                testCase: i + 1,
                passed: mockPassed,
                hidden: tc.hidden,
                runtime: `${(Math.random() * 50).toFixed(0)}ms`
            });
        }

        const allPassed = passed === problem.testCases.length;

        res.json({
            success: true,
            status: allPassed ? 'Accepted' : 'Wrong Answer',
            passed,
            total: problem.testCases.length,
            results: results.map(r => r.hidden ? { ...r, input: 'Hidden', expected: 'Hidden', actual: 'Hidden' } : r),
            executionTime: `${(Math.random() * 100).toFixed(0)}ms`,
            memory: `${(10 + Math.random() * 20).toFixed(1)} MB`,
            score: Math.round((passed / problem.testCases.length) * 100)
        });
    } catch (error) {
        console.error('Submit error:', error);
        res.json({ success: false, error: error.message });
    }
});

// ── POST /generate – generate a new problem using AI ──
router.post('/generate', async (req, res) => {
    const { difficulty, category } = req.body;

    try {
        const prompt = `Generate a unique coding problem with these specs:
- Difficulty: ${difficulty || 'medium'}
- Category: ${category || 'algorithms'}

Return ONLY valid JSON in this exact format:
{
  "title": "Problem Title",
  "difficulty": "${difficulty || 'medium'}",
  "category": "${category || 'algorithms'}",
  "description": "Clear problem description with requirements",
  "examples": [
    {"input": "example input description", "output": "expected output", "explanation": "brief walkthrough"},
    {"input": "another example", "output": "expected output", "explanation": "brief walkthrough"}
  ],
  "constraints": ["constraint 1", "constraint 2"],
  "hints": ["hint 1", "hint 2"],
  "starterCode": {
    "python": "def solution():\\n    pass",
    "javascript": "function solution() {\\n    // code here\\n}",
    "java": "class Solution {\\n    // code here\\n}",
    "cpp": "// code here"
  },
  "testCases": [
    {"input": {"param": "value"}, "output": "expected", "hidden": false},
    {"input": {"param": "value"}, "output": "expected", "hidden": true}
  ],
  "tags": ["tag1", "tag2"],
  "timeLimit": 20
}`;

        const completion = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert coding problem generator like LeetCode. Generate clear, solvable problems with correct test cases. Return ONLY valid JSON.'
                    },
                    { role: 'user', content: prompt }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.7,
                max_tokens: 2000,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response = completion.data.choices[0]?.message?.content || '';
        const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const problem = JSON.parse(jsonMatch[0]);
            problem.id = 'ai_' + Date.now();
            if (!problem.starterCode) {
                problem.starterCode = {
                    python: 'def solution():\n    pass',
                    javascript: 'function solution() {\n    // code here\n}',
                    java: 'class Solution {\n    // code here\n}',
                    cpp: '// code here'
                };
            }
            res.json({ problem });
        } else {
            throw new Error('Failed to parse AI response');
        }
    } catch (error) {
        console.error('AI generation error:', error.message);
        // Return a random problem from the bank as fallback
        const diff = difficulty || 'medium';
        const problems = problemBank[diff] || problemBank.medium;
        const fallback = problems[Math.floor(Math.random() * problems.length)];
        res.json({ problem: fallback });
    }
});

// ── POST /problems/:id/hint – get AI hint for the problem ──
router.post('/problems/:id/hint', async (req, res) => {
    const { id } = req.params;
    const { code, language } = req.body;

    let problem = null;
    for (const d of ['easy', 'medium', 'hard']) {
        problem = problemBank[d]?.find(p => p.id === id);
        if (problem) break;
    }

    if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
    }

    try {
        const prompt = `The user is solving this coding problem:
Title: ${problem.title}
Description: ${problem.description}

Their current code (${language}):
${code || 'No code written yet'}

Give a helpful hint WITHOUT revealing the full solution. Be concise (2-3 sentences).
Suggest the next step or point out what they might be missing.`;

        const completion = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful coding tutor. Give hints, not solutions. Be encouraging and brief.'
                    },
                    { role: 'user', content: prompt }
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0.7,
                max_tokens: 200,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const hint = completion.data.choices[0]?.message?.content || 'Try breaking the problem into smaller steps.';
        res.json({ hint });
    } catch (error) {
        console.error('Hint error:', error.message);
        const fallbackHints = problem.hints || ['Think about the data structure that best fits this problem.', 'Consider edge cases carefully.'];
        res.json({ hint: fallbackHints[Math.floor(Math.random() * fallbackHints.length)] });
    }
});

export default router;
