import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
    constructor() {
        this.tempDir = path.join(__dirname, '..', 'temp');
        this.initTempDir();
    }

    async initTempDir() {
        try { await fs.mkdir(this.tempDir, { recursive: true }); } catch (e) { console.error('Failed to create temp dir:', e); }
    }

    async runTests(code, language, testCases, functionName) {
        const results = { totalTests: testCases.length, passedTests: 0, failedTests: 0, hiddenPassed: 0, hiddenTotal: testCases.filter(tc => tc.hidden).length, testResults: [], allPassed: false, error: null };
        try {
            for (let i = 0; i < testCases.length; i++) {
                const testCase = testCases[i];
                const result = await this.runSingleTest(code, language, testCase, functionName);
                results.testResults.push({ caseNumber: i + 1, hidden: testCase.hidden, passed: result.passed, input: testCase.hidden ? 'Hidden' : testCase.input, expectedOutput: testCase.hidden ? 'Hidden' : testCase.output, actualOutput: result.output, error: result.error, executionTime: result.executionTime });
                if (result.passed) { results.passedTests++; if (testCase.hidden) results.hiddenPassed++; } else { results.failedTests++; }
            }
            results.allPassed = (results.passedTests === results.totalTests);
        } catch (error) { results.error = error.message; }
        return results;
    }

    async runSingleTest(code, language, testCase, functionName) {
        const startTime = Date.now();
        try {
            const testCode = this.generateTestCode(code, language, testCase, functionName);
            const result = await this.executeCode(testCode, language);
            const executionTime = Date.now() - startTime;
            if (result.error) return { passed: false, output: null, error: result.error, executionTime };
            const passed = this.compareOutputs(result.output, testCase.output, language);
            return { passed, output: result.output, error: null, executionTime };
        } catch (error) {
            return { passed: false, output: null, error: error.message, executionTime: Date.now() - startTime };
        }
    }

    extractFunctionName(userCode, language) {
        let match;
        switch (language) {
            case 'python': match = userCode.match(/^def\s+([a-zA-Z_]\w*)\s*\(/m); return match ? match[1] : null;
            case 'javascript': match = userCode.match(/(?:function\s+([a-zA-Z_]\w*)\s*\(|(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:function|\())/m); return match ? (match[1] || match[2]) : null;
            case 'java': match = userCode.match(/public\s+\S+\s+([a-zA-Z_]\w*)\s*\(/m); return match ? match[1] : null;
            case 'cpp': match = userCode.match(/(?:int|void|bool|string|vector\s*<[^>]+>|auto)\s+([a-zA-Z_]\w*)\s*\(/m); return match ? match[1] : null;
            default: return null;
        }
    }

    generateTestCode(userCode, language, testCase, functionName) {
        const expectedName = functionName[language];
        const detectedName = this.extractFunctionName(userCode, language);
        const fname = detectedName || expectedName;
        switch (language) {
            case 'python': return this.generatePythonTest(userCode, testCase, fname);
            case 'javascript': return this.generateJavaScriptTest(userCode, testCase, fname);
            case 'java': return this.generateJavaTest(userCode, testCase, fname);
            case 'cpp': return this.generateCppTest(userCode, testCase, fname);
            default: throw new Error(`Unsupported language: ${language}`);
        }
    }

    generatePythonTest(userCode, testCase, functionName) {
        const inputArgs = this.formatPythonArgs(testCase.input);
        return `import json\nimport sys\n\n${userCode}\n\ntry:\n    result = ${functionName}(${inputArgs})\n    print(json.dumps(result))\nexcept Exception as e:\n    print(f"ERROR: {str(e)}", file=sys.stderr)\n    sys.exit(1)\n`;
    }

    generateJavaScriptTest(userCode, testCase, functionName) {
        const inputArgs = this.formatJavaScriptArgs(testCase.input);
        return `${userCode}\n\ntry {\n    const result = ${functionName}(${inputArgs});\n    console.log(JSON.stringify(result));\n} catch (error) {\n    console.error('ERROR: ' + error.message);\n    process.exit(1);\n}\n`;
    }

    generateJavaTest(userCode, testCase, functionName) {
        const inputArgs = this.formatJavaArgs(testCase.input);
        const methodCall = this.generateJavaMethodCall(functionName, inputArgs, testCase);
        return `import java.util.*;\n\n${userCode}\n\nclass Main {\n    public static void main(String[] args) {\n        try {\n            Solution sol = new Solution();\n            ${methodCall}\n        } catch (Exception e) {\n            System.err.println("ERROR: " + e.getMessage());\n            System.exit(1);\n        }\n    }\n}\n`;
    }

    generateCppTest(userCode, testCase, functionName) {
        const inputSetup = this.formatCppArgs(testCase.input);
        const methodCall = this.generateCppMethodCall(functionName, testCase);
        return `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\n${userCode}\n\nint main() {\n    try {\n        ${inputSetup}\n        ${methodCall}\n    } catch (const exception& e) {\n        cerr << "ERROR: " << e.what() << endl;\n        return 1;\n    }\n    return 0;\n}\n`;
    }

    formatPythonArgs(input) {
        if (input && input.__raw) return input.__raw;
        if (typeof input === 'string') return input;
        if (Array.isArray(input)) return input.map(v => JSON.stringify(v)).join(', ');
        const args = [];
        for (const [key, value] of Object.entries(input)) { args.push(JSON.stringify(value)); }
        return args.join(', ');
    }

    formatJavaScriptArgs(input) {
        if (input && input.__raw) return input.__raw;
        if (typeof input === 'string') return input;
        if (Array.isArray(input)) return input.map(v => JSON.stringify(v)).join(', ');
        const args = [];
        for (const [key, value] of Object.entries(input)) { args.push(JSON.stringify(value)); }
        return args.join(', ');
    }

    formatJavaArgs(input) {
        const args = {};
        let setupCode = '';
        for (const [key, value] of Object.entries(input)) {
            if (Array.isArray(value)) {
                if (typeof value[0] === 'number') { setupCode += `int[] ${key} = {${value.join(', ')}};\n            `; args[key] = key; }
                else if (typeof value[0] === 'string') { const formatted = value.map(v => `"${v}"`).join(', '); setupCode += `String[] ${key} = {${formatted}};\n            `; args[key] = key; }
            } else if (typeof value === 'string') { setupCode += `String ${key} = "${value}";\n            `; args[key] = key; }
            else { setupCode += `int ${key} = ${value};\n            `; args[key] = key; }
        }
        return { setup: setupCode, args };
    }

    generateJavaMethodCall(functionName, argsObj, testCase) {
        const argsList = Object.values(argsObj.args).join(', ');
        const output = testCase.output;
        if (Array.isArray(output)) return `${argsObj.setup}int[] result = sol.${functionName}(${argsList});\n            System.out.println(Arrays.toString(result));`;
        else if (typeof output === 'boolean') return `${argsObj.setup}boolean result = sol.${functionName}(${argsList});\n            System.out.println(result);`;
        else if (typeof output === 'string') return `${argsObj.setup}String result = sol.${functionName}(${argsList});\n            System.out.println(result);`;
        else return `${argsObj.setup}int result = sol.${functionName}(${argsList});\n            System.out.println(result);`;
    }

    formatCppArgs(input) {
        let setupCode = '';
        for (const [key, value] of Object.entries(input)) {
            if (Array.isArray(value)) { if (typeof value[0] === 'number') setupCode += `vector<int> ${key} = {${value.join(', ')}};\n        `; }
            else if (typeof value === 'string') setupCode += `string ${key} = "${value}";\n        `;
            else setupCode += `int ${key} = ${value};\n        `;
        }
        return setupCode;
    }

    generateCppMethodCall(functionName, testCase) {
        const argsList = Object.keys(testCase.input).join(', ');
        const output = testCase.output;
        if (Array.isArray(output)) return `auto result = ${functionName}(${argsList});\n        cout << "[";\n        for (size_t i = 0; i < result.size(); i++) { cout << result[i]; if (i < result.size() - 1) cout << ", "; }\n        cout << "]" << endl;`;
        else if (typeof output === 'boolean') return `bool result = ${functionName}(${argsList});\n        cout << (result ? "true" : "false") << endl;`;
        else if (typeof output === 'string') return `string result = ${functionName}(${argsList});\n        cout << result << endl;`;
        else return `int result = ${functionName}(${argsList});\n        cout << result << endl;`;
    }

    async executeCode(code, language) {
        const fileId = uuidv4();
        let filePath, command;
        try {
            switch (language) {
                case 'python': filePath = path.join(this.tempDir, `${fileId}.py`); await fs.writeFile(filePath, code); command = `python "${filePath}"`; break;
                case 'javascript': filePath = path.join(this.tempDir, `${fileId}.js`); await fs.writeFile(filePath, code); command = `node "${filePath}"`; break;
                case 'java': filePath = path.join(this.tempDir, `Main.java`); await fs.writeFile(filePath, code); command = `cd "${this.tempDir}" && javac Main.java && java Main`; break;
                case 'cpp': filePath = path.join(this.tempDir, `${fileId}.cpp`); const exePath = path.join(this.tempDir, `${fileId}.exe`); await fs.writeFile(filePath, code); command = `g++ "${filePath}" -o "${exePath}" && "${exePath}"`; break;
                default: throw new Error(`Unsupported language: ${language}`);
            }
            return await this.runCommand(command);
        } finally {
            try {
                if (filePath) await fs.unlink(filePath).catch(() => {});
                if (language === 'cpp') { const exePath2 = path.join(this.tempDir, `${fileId}.exe`); await fs.unlink(exePath2).catch(() => {}); }
                if (language === 'java') { await fs.unlink(path.join(this.tempDir, 'Main.class')).catch(() => {}); await fs.unlink(path.join(this.tempDir, 'Solution.class')).catch(() => {}); }
            } catch (e) { /* ignore cleanup errors */ }
        }
    }

    runCommand(command) {
        return new Promise((resolve) => {
            exec(command, { timeout: 5000, maxBuffer: 512 * 1024 }, (error, stdout, stderr) => {
                if (error) resolve({ output: null, error: stderr || error.message });
                else resolve({ output: stdout.trim(), error: null });
            });
        });
    }

    parseValue(val) {
        if (val === null || val === undefined) return val;
        if (typeof val !== 'string') return val;
        const trimmed = val.trim();
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        try { return JSON.parse(trimmed); } catch (e) {}
        return val;
    }

    compareOutputs(actual, expected, language) {
        if (!actual) return false;
        try {
            let actualParsed;
            if (language === 'java' && actual.includes('[')) actualParsed = JSON.parse(actual.replace(/\s/g, ''));
            else actualParsed = this.parseValue(actual);
            let expectedParsed = this.parseValue(expected);
            return JSON.stringify(actualParsed) === JSON.stringify(expectedParsed);
        } catch (error) {
            return actual.trim() === String(expected).trim();
        }
    }
}

export default new TestRunner();
