import express from 'express';
import {v4 as uuidv4} from 'uuid';

const router=express.Router();

// Sample questions database
const questions=[
    {
        id: '1',
        title: 'Two Sum',
        difficulty: 'easy',
        category: 'arrays',
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        examples: [
            {input: 'nums = [2,7,11,15], target = 9', output: '[0,1]'},
            {input: 'nums = [3,2,4], target = 6', output: '[1,2]'},
        ],
        starterCode: {
            python: 'def twoSum(nums, target):\n    pass',
            javascript: 'function twoSum(nums, target) {\n    // your code here\n}',
            java: 'public int[] twoSum(int[] nums, int target) {\n    // your code here\n}',
        },
    },
    {
        id: '2',
        title: 'Valid Parentheses',
        difficulty: 'easy',
        category: 'stack',
        description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.',
        examples: [
            {input: 's = "()"', output: 'true'},
            {input: 's = "()[]{}"', output: 'true'},
        ],
        starterCode: {
            python: 'def isValid(s):\n    pass',
            javascript: 'function isValid(s) {\n    // your code here\n}',
            java: 'public boolean isValid(String s) {\n    // your code here\n}',
        },
    },
    {
        id: '3',
        title: 'Binary Tree Level Order Traversal',
        difficulty: 'medium',
        category: 'tree',
        description: 'Given the root of a binary tree, return the level order traversal of its nodes\' values.',
        examples: [
            {input: 'root = [3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]'},
        ],
        starterCode: {
            python: 'def levelOrder(root):\n    pass',
            javascript: 'function levelOrder(root) {\n    // your code here\n}',
            java: 'public List<List<Integer>> levelOrder(TreeNode root) {\n    // your code here\n}',
        },
    },
    {
        id: '4',
        title: 'Longest Substring Without Repeating Characters',
        difficulty: 'medium',
        category: 'string',
        description: 'Given a string s, find the length of the longest substring without repeating characters.',
        examples: [
            {input: 's = "abcabcbb"', output: '3'},
            {input: 's = "pwwkew"', output: '3'},
        ],
        starterCode: {
            python: 'def lengthOfLongestSubstring(s):\n    pass',
            javascript: 'function lengthOfLongestSubstring(s) {\n    // your code here\n}',
            java: 'public int lengthOfLongestSubstring(String s) {\n    // your code here\n}',
        },
    },
    {
        id: '5',
        title: 'Merge Two Sorted Lists',
        difficulty: 'easy',
        category: 'linked-list',
        description: 'Merge two sorted linked lists and return it as a sorted list.',
        examples: [
            {input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]'},
        ],
        starterCode: {
            python: 'def mergeTwoLists(list1, list2):\n    pass',
            javascript: 'function mergeTwoLists(list1, list2) {\n    // your code here\n}',
            java: 'public ListNode mergeTwoLists(ListNode list1, ListNode list2) {\n    // your code here\n}',
        },
    },
];

// Get all questions
router.get('/', (req, res) =>
{
    const {difficulty, category}=req.query;
    let filtered=[...questions];

    if (difficulty)
    {
        filtered=filtered.filter(q => q.difficulty===difficulty);
    }

    if (category)
    {
        filtered=filtered.filter(q => q.category===category);
    }

    res.json(filtered);
});

// Get question by ID
router.get('/:id', (req, res) =>
{
    const question=questions.find(q => q.id===req.params.id);
    if (!question)
    {
        return res.status(404).json({error: 'Question not found'});
    }
    res.json(question);
});

// Get random questions
router.get('/random/:count', (req, res) =>
{
    const count=parseInt(req.params.count);
    const shuffled=[...questions].sort(() => 0.5-Math.random());
    res.json(shuffled.slice(0, Math.min(count, shuffled.length)));
});

// Create custom question
router.post('/', (req, res) =>
{
    const question={
        id: uuidv4(),
        ...req.body,
        createdAt: new Date(),
        isCustom: true,
    };
    questions.push(question);
    res.json(question);
});

// Update question
router.put('/:id', (req, res) =>
{
    const index=questions.findIndex(q => q.id===req.params.id);
    if (index===-1)
    {
        return res.status(404).json({error: 'Question not found'});
    }

    questions[index]={...questions[index], ...req.body, updatedAt: new Date()};
    res.json(questions[index]);
});

// Delete question
router.delete('/:id', (req, res) =>
{
    const index=questions.findIndex(q => q.id===req.params.id);
    if (index===-1)
    {
        return res.status(404).json({error: 'Question not found'});
    }

    questions.splice(index, 1);
    res.json({success: true, message: 'Question deleted'});
});

export default router;
