/**
 * Question Bank Service
 * Manages coding questions with filtering by difficulty, company, topics, and domains
 */
class QuestionBank
{
    constructor()
    {
        this.questions=this.initializeQuestions();
        this.userProgress=new Map();
    }

    initializeQuestions()
    {
        return [
            {
                id: "q_two_sum",
                title: "Two Sum",
                difficulty: "easy",
                domain: "data-structures",
                topics: ["arrays", "hash-table"],
                companies: ["google", "amazon", "facebook", "microsoft"],
                description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
                examples: [
                    {input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."},
                    {input: "nums = [3,2,4], target = 6", output: "[1,2]"}
                ],
                constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9", "Only one valid answer exists"],
                starterCode: {
                    python: "def two_sum(nums, target):\n    # Write your code here\n    pass",
                    javascript: "function twoSum(nums, target) {\n    // Write your code here\n}",
                    java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}",
                    cpp: "#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}"
                },
                testCases: [
                    {input: {nums: [2, 7, 11, 15], target: 9}, output: [0, 1], hidden: false},
                    {input: {nums: [3, 2, 4], target: 6}, output: [1, 2], hidden: false},
                    {input: {nums: [3, 3], target: 6}, output: [0, 1], hidden: true},
                    {input: {nums: [-1, -2, -3, -4, -5], target: -8}, output: [2, 4], hidden: true},
                    {input: {nums: [1, 5, 3, 7, 9, 2], target: 10}, output: [0, 4], hidden: true}
                ],
                functionName: {python: "two_sum", javascript: "twoSum", java: "twoSum", cpp: "twoSum"},
                hints: ["Use a hash map to store numbers you've seen", "For each number, check if target - number exists in the map", "Time complexity should be O(n)"],
                timeComplexity: "O(n)",
                spaceComplexity: "O(n)"
            },
            {
                id: "q_valid_palindrome",
                title: "Valid Palindrome",
                difficulty: "easy",
                domain: "algorithms",
                topics: ["strings", "two-pointers"],
                companies: ["facebook", "microsoft", "amazon"],
                description: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string `s`, return `true` if it is a palindrome, or `false` otherwise.",
                examples: [
                    {input: 's = "A man, a plan, a canal: Panama"', output: "true", explanation: 'After removing non-alphanumeric chars and converting to lowercase: "amanaplanacanalpanama" is a palindrome'},
                    {input: 's = "race a car"', output: "false"}
                ],
                constraints: ["1 <= s.length <= 2 * 10^5", "s consists only of printable ASCII characters"],
                starterCode: {
                    python: "def is_palindrome(s):\n    # Write your code here\n    pass",
                    javascript: "function isPalindrome(s) {\n    // Write your code here\n}",
                    java: "class Solution {\n    public boolean isPalindrome(String s) {\n        // Write your code here\n        return false;\n    }\n}",
                    cpp: "#include <string>\nusing namespace std;\n\nbool isPalindrome(string s) {\n    // Write your code here\n    return false;\n}"
                },
                testCases: [
                    {input: {s: "A man, a plan, a canal: Panama"}, output: true, hidden: false},
                    {input: {s: "race a car"}, output: false, hidden: false},
                    {input: {s: " "}, output: true, hidden: true},
                    {input: {s: "0P"}, output: false, hidden: true},
                    {input: {s: "A1b2B1a"}, output: true, hidden: true}
                ],
                functionName: {python: "is_palindrome", javascript: "isPalindrome", java: "isPalindrome", cpp: "isPalindrome"},
                hints: ["Use two pointers from both ends", "Skip non-alphanumeric characters", "Compare characters case-insensitively"],
                timeComplexity: "O(n)",
                spaceComplexity: "O(1)"
            },
            {
                id: "q_longest_substring",
                title: "Longest Substring Without Repeating Characters",
                difficulty: "medium",
                domain: "algorithms",
                topics: ["strings", "sliding-window", "hash-table"],
                companies: ["amazon", "google", "adobe", "facebook"],
                description: "Given a string `s`, find the length of the longest substring without repeating characters.",
                examples: [
                    {input: 's = "abcabcbb"', output: "3", explanation: 'The answer is "abc", with the length of 3.'},
                    {input: 's = "bbbbb"', output: "1", explanation: 'The answer is "b", with the length of 1.'},
                    {input: 's = "pwwkew"', output: "3", explanation: 'The answer is "wke", with the length of 3.'}
                ],
                constraints: ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces"],
                starterCode: {
                    python: "def length_of_longest_substring(s):\n    # Write your code here\n    pass",
                    javascript: "function lengthOfLongestSubstring(s) {\n    // Write your code here\n}",
                    java: "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your code here\n        return 0;\n    }\n}",
                    cpp: "#include <string>\nusing namespace std;\n\nint lengthOfLongestSubstring(string s) {\n    // Write your code here\n    return 0;\n}"
                },
                testCases: [
                    {input: {s: "abcabcbb"}, output: 3, hidden: false},
                    {input: {s: "bbbbb"}, output: 1, hidden: false},
                    {input: {s: "pwwkew"}, output: 3, hidden: false},
                    {input: {s: ""}, output: 0, hidden: true},
                    {input: {s: "dvdf"}, output: 3, hidden: true}
                ],
                functionName: {python: "length_of_longest_substring", javascript: "lengthOfLongestSubstring", java: "lengthOfLongestSubstring", cpp: "lengthOfLongestSubstring"},
                hints: ["Use sliding window technique", "Maintain a set or map of characters in current window", "Move left pointer when duplicate found"],
                timeComplexity: "O(n)",
                spaceComplexity: "O(min(n, m)) where m is charset size"
            },
            {
                id: "q_container_most_water",
                title: "Container With Most Water",
                difficulty: "medium",
                domain: "algorithms",
                topics: ["arrays", "two-pointers", "greedy"],
                companies: ["google", "amazon", "facebook"],
                description: "You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i`th line are `(i, 0)` and `(i, height[i])`.\n\nFind two lines that together with the x-axis form a container, such that the container contains the most water.\n\nReturn the maximum amount of water a container can store.",
                examples: [
                    {input: "height = [1,8,6,2,5,4,8,3,7]", output: "49", explanation: "The max area is between index 1 and 8: 7 * 7 = 49"}
                ],
                constraints: ["n == height.length", "2 <= n <= 10^5", "0 <= height[i] <= 10^4"],
                starterCode: {
                    python: "def max_area(height):\n    # Write your code here\n    pass",
                    javascript: "function maxArea(height) {\n    // Write your code here\n}",
                    java: "class Solution {\n    public int maxArea(int[] height) {\n        // Write your code here\n        return 0;\n    }\n}",
                    cpp: "#include <vector>\nusing namespace std;\n\nint maxArea(vector<int>& height) {\n    // Write your code here\n    return 0;\n}"
                },
                testCases: [
                    {input: {height: [1, 8, 6, 2, 5, 4, 8, 3, 7]}, output: 49, hidden: false},
                    {input: {height: [1, 1]}, output: 1, hidden: false},
                    {input: {height: [4, 3, 2, 1, 4]}, output: 16, hidden: true},
                    {input: {height: [1, 2, 1]}, output: 2, hidden: true}
                ],
                functionName: {python: "max_area", javascript: "maxArea", java: "maxArea", cpp: "maxArea"},
                hints: ["Use two pointers at both ends", "Move the pointer with smaller height", "Calculate area at each step and track maximum"],
                timeComplexity: "O(n)",
                spaceComplexity: "O(1)"
            },
            {
                id: "q_median_sorted_arrays",
                title: "Median of Two Sorted Arrays",
                difficulty: "hard",
                domain: "algorithms",
                topics: ["arrays", "binary-search", "divide-and-conquer"],
                companies: ["google", "amazon", "microsoft", "apple"],
                description: "Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays.\n\nThe overall run time complexity should be O(log (m+n)).",
                examples: [
                    {input: "nums1 = [1,3], nums2 = [2]", output: "2.0", explanation: "merged array = [1,2,3] and median is 2"},
                    {input: "nums1 = [1,2], nums2 = [3,4]", output: "2.5", explanation: "merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5"}
                ],
                constraints: ["nums1.length == m", "nums2.length == n", "0 <= m <= 1000", "0 <= n <= 1000", "1 <= m + n <= 2000", "-10^6 <= nums1[i], nums2[i] <= 10^6"],
                starterCode: {
                    python: "def find_median_sorted_arrays(nums1, nums2):\n    # Write your code here\n    pass",
                    javascript: "function findMedianSortedArrays(nums1, nums2) {\n    // Write your code here\n}",
                    java: "class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        // Write your code here\n        return 0.0;\n    }\n}",
                    cpp: "#include <vector>\nusing namespace std;\n\ndouble findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n    // Write your code here\n    return 0.0;\n}"
                },
                testCases: [
                    {input: {nums1: [1, 3], nums2: [2]}, output: 2.0, hidden: false},
                    {input: {nums1: [1, 2], nums2: [3, 4]}, output: 2.5, hidden: false},
                    {input: {nums1: [], nums2: [1]}, output: 1.0, hidden: true},
                    {input: {nums1: [2], nums2: []}, output: 2.0, hidden: true}
                ],
                functionName: {python: "find_median_sorted_arrays", javascript: "findMedianSortedArrays", java: "findMedianSortedArrays", cpp: "findMedianSortedArrays"},
                hints: ["Use binary search on the smaller array", "Find the correct partition point in both arrays", "Ensure elements on left are smaller than elements on right"],
                timeComplexity: "O(log(min(m,n)))",
                spaceComplexity: "O(1)"
            },
            {
                id: "q_trapping_rain_water",
                title: "Trapping Rain Water",
                difficulty: "hard",
                domain: "algorithms",
                topics: ["arrays", "two-pointers", "dynamic-programming", "stack"],
                companies: ["amazon", "google", "facebook", "microsoft"],
                description: "Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.",
                examples: [
                    {input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", output: "6", explanation: "The elevation map traps 6 units of rain water"},
                    {input: "height = [4,2,0,3,2,5]", output: "9"}
                ],
                constraints: ["n == height.length", "1 <= n <= 2 * 10^4", "0 <= height[i] <= 10^5"],
                starterCode: {
                    python: "def trap(height):\n    # Write your code here\n    pass",
                    javascript: "function trap(height) {\n    // Write your code here\n}",
                    java: "class Solution {\n    public int trap(int[] height) {\n        // Write your code here\n        return 0;\n    }\n}",
                    cpp: "#include <vector>\nusing namespace std;\n\nint trap(vector<int>& height) {\n    // Write your code here\n    return 0;\n}"
                },
                testCases: [
                    {input: {height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]}, output: 6, hidden: false},
                    {input: {height: [4, 2, 0, 3, 2, 5]}, output: 9, hidden: false},
                    {input: {height: [1, 0, 1]}, output: 1, hidden: true},
                    {input: {height: [5, 4, 1, 2]}, output: 1, hidden: true}
                ],
                functionName: {python: "trap", javascript: "trap", java: "trap", cpp: "trap"},
                hints: ["Water level is determined by min of left max and right max heights", "Can use two pointers approach for O(1) space", "Or precompute left_max and right_max arrays"],
                timeComplexity: "O(n)",
                spaceComplexity: "O(1)"
            },
            {
                id: "q_binary_tree_level_order",
                title: "Binary Tree Level Order Traversal",
                difficulty: "medium",
                domain: "data-structures",
                topics: ["tree", "breadth-first-search", "binary-tree"],
                companies: ["amazon", "microsoft", "facebook", "linkedin"],
                description: "Given the `root` of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).",
                examples: [
                    {input: "root = [3,9,20,null,null,15,7]", output: "[[3],[9,20],[15,7]]"}
                ],
                constraints: ["The number of nodes in the tree is in the range [0, 2000]", "-1000 <= Node.val <= 1000"],
                starterCode: {
                    python: "# Definition for a binary tree node\nclass TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\ndef level_order(root):\n    # Write your code here\n    pass",
                    javascript: "// Definition for a binary tree node\nfunction TreeNode(val, left, right) {\n    this.val = (val===undefined ? 0 : val)\n    this.left = (left===undefined ? null : left)\n    this.right = (right===undefined ? null : right)\n}\n\nfunction levelOrder(root) {\n    // Write your code here\n}",
                    java: "class TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n    TreeNode(int x) { val = x; }\n}\n\nclass Solution {\n    public List<List<Integer>> levelOrder(TreeNode root) {\n        // Write your code here\n        return new ArrayList<>();\n    }\n}",
                    cpp: "struct TreeNode {\n    int val;\n    TreeNode *left;\n    TreeNode *right;\n    TreeNode(int x) : val(x), left(NULL), right(NULL) {}\n};\n\nvector<vector<int>> levelOrder(TreeNode* root) {\n    // Write your code here\n    return {};\n}"
                },
                testCases: [],
                functionName: {python: "level_order", javascript: "levelOrder", java: "levelOrder", cpp: "levelOrder"},
                hints: ["Use a queue for BFS traversal", "Process nodes level by level", "Track the size of queue at each level"],
                timeComplexity: "O(n)",
                spaceComplexity: "O(n)"
            },
            {
                id: "q_valid_parentheses",
                title: "Valid Parentheses",
                difficulty: "easy",
                domain: "data-structures",
                topics: ["string", "stack"],
                companies: ["amazon", "facebook", "microsoft", "google"],
                description: "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
                examples: [
                    {input: 's = "()"', output: "true"},
                    {input: 's = "()[]{}"', output: "true"},
                    {input: 's = "(]"', output: "false"}
                ],
                constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."],
                starterCode: {
                    python: "def is_valid(s):\n    # Write your code here\n    pass",
                    javascript: "function isValid(s) {\n    // Write your code here\n}",
                    java: "import java.util.*;\n\nclass Solution {\n    public boolean isValid(String s) {\n        // Write your code here\n        return false;\n    }\n}",
                    cpp: "#include <string>\n#include <stack>\nusing namespace std;\n\nbool isValid(string s) {\n    // Write your code here\n    return false;\n}"
                },
                testCases: [
                    {input: {s: "()"}, output: true, hidden: false},
                    {input: {s: "()[]{}"}, output: true, hidden: false},
                    {input: {s: "(]"}, output: false, hidden: false},
                    {input: {s: "([)]"}, output: false, hidden: true},
                    {input: {s: "{[]}"}, output: true, hidden: true}
                ],
                functionName: {python: "is_valid", javascript: "isValid", java: "isValid", cpp: "isValid"},
                hints: ["Use a stack to keep track of opening brackets", "When you encounter a closing bracket, check if it matches the top of the stack", "At the end, the stack should be empty"],
                timeComplexity: "O(n)",
                spaceComplexity: "O(n)"
            },
            {
                id: "q_merge_intervals",
                title: "Merge Intervals",
                difficulty: "medium",
                domain: "algorithms",
                topics: ["arrays", "sorting"],
                companies: ["facebook", "google", "amazon", "microsoft"],
                description: "Given an array of `intervals` where `intervals[i] = [starti, endi]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
                examples: [
                    {input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]", explanation: "Intervals [1,3] and [2,6] overlap, so merge them into [1,6]"},
                    {input: "intervals = [[1,4],[4,5]]", output: "[[1,5]]"}
                ],
                constraints: ["1 <= intervals.length <= 10^4", "intervals[i].length == 2", "0 <= start <= end <= 10^4"],
                starterCode: {
                    python: "def merge(intervals):\n    # Write your code here\n    pass",
                    javascript: "function merge(intervals) {\n    // Write your code here\n}",
                    java: "import java.util.*;\n\nclass Solution {\n    public int[][] merge(int[][] intervals) {\n        // Write your code here\n        return new int[][]{};\n    }\n}",
                    cpp: "#include <vector>\n#include <algorithm>\nusing namespace std;\n\nvector<vector<int>> merge(vector<vector<int>>& intervals) {\n    // Write your code here\n    return {};\n}"
                },
                testCases: [
                    {input: {intervals: [[1, 3], [2, 6], [8, 10], [15, 18]]}, output: [[1, 6], [8, 10], [15, 18]], hidden: false},
                    {input: {intervals: [[1, 4], [4, 5]]}, output: [[1, 5]], hidden: false},
                    {input: {intervals: [[1, 4], [0, 4]]}, output: [[0, 4]], hidden: true},
                    {input: {intervals: [[1, 4], [2, 3]]}, output: [[1, 4]], hidden: true}
                ],
                functionName: {python: "merge", javascript: "merge", java: "merge", cpp: "merge"},
                hints: ["Sort intervals by start time first", "Iterate through sorted intervals and merge overlapping ones", "Check if current interval overlaps with the last merged interval"],
                timeComplexity: "O(n log n)",
                spaceComplexity: "O(n)"
            }
        ];
    }

    sanitizeQuestion(question)
    {
        if (!question) return null;
        const {testCases, functionName, ...publicQuestion}=question;
        publicQuestion.visibleTestCases=testCases? testCases.filter(tc => !tc.hidden).length:0;
        publicQuestion.totalTestCases=testCases? testCases.length:0;
        return publicQuestion;
    }

    getFilterOptions()
    {
        const allCompanies=new Set();
        const allTopics=new Set();
        const allDomains=new Set();
        this.questions.forEach(q =>
        {
            q.companies.forEach(c => allCompanies.add(c));
            q.topics.forEach(t => allTopics.add(t));
            allDomains.add(q.domain);
        });
        return {
            difficulties: ['easy', 'medium', 'hard'],
            companies: Array.from(allCompanies).sort(),
            topics: Array.from(allTopics).sort(),
            domains: Array.from(allDomains).sort()
        };
    }

    filterQuestions({difficulty, company, topics, domain})
    {
        return this.questions.filter(q =>
        {
            if (difficulty&&q.difficulty!==difficulty) return false;
            if (company&&!q.companies.includes(company)) return false;
            if (domain&&q.domain!==domain) return false;
            if (topics&&topics.length>0)
            {
                if (!topics.every(topic => q.topics.includes(topic))) return false;
            }
            return true;
        });
    }

    getRandomQuestion(filters={})
    {
        const filtered=this.filterQuestions(filters);
        if (filtered.length===0) return null;
        return filtered[Math.floor(Math.random()*filtered.length)];
    }

    getQuestionById(id)
    {
        return this.questions.find(q => q.id===id);
    }

    getAllQuestions(filters={})
    {
        if (Object.keys(filters).length===0) return this.questions;
        return this.filterQuestions(filters);
    }

    markQuestionSolved(userId, questionId, language, code, executionResult)
    {
        if (!this.userProgress.has(userId))
        {
            this.userProgress.set(userId, {solved: [], attempts: [], stats: {easy: 0, medium: 0, hard: 0, total: 0}});
        }
        const userProgress=this.userProgress.get(userId);
        const question=this.getQuestionById(questionId);
        if (!question) return null;
        const alreadySolved=userProgress.solved.find(s => s.questionId===questionId);
        if (!alreadySolved&&!executionResult.hasError)
        {
            userProgress.solved.push({questionId, solvedAt: Date.now(), language, difficulty: question.difficulty});
            userProgress.stats[question.difficulty]++;
            userProgress.stats.total++;
        }
        userProgress.attempts.push({questionId, timestamp: Date.now(), language, success: !executionResult.hasError, executionTime: executionResult.executionTime});
        return userProgress;
    }

    getUserProgress(userId)
    {
        return this.userProgress.get(userId)||{solved: [], attempts: [], stats: {easy: 0, medium: 0, hard: 0, total: 0}};
    }

    getStatistics()
    {
        const stats={total: this.questions.length, byDifficulty: {easy: 0, medium: 0, hard: 0}, byDomain: {}, byCompany: {}, byTopic: {}};
        this.questions.forEach(q =>
        {
            stats.byDifficulty[q.difficulty]++;
            stats.byDomain[q.domain]=(stats.byDomain[q.domain]||0)+1;
            q.companies.forEach(c => {stats.byCompany[c]=(stats.byCompany[c]||0)+1;});
            q.topics.forEach(t => {stats.byTopic[t]=(stats.byTopic[t]||0)+1;});
        });
        return stats;
    }
}

export default new QuestionBank();
