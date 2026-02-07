import {execSync, spawn} from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import {fileURLToPath} from 'url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

const MAX_EXECUTION_TIME=parseInt(process.env.MAX_EXECUTION_TIME)||5000;
const MAX_OUTPUT_SIZE=1024*512;
const MAX_CODE_SIZE=1024*100;

class CodeExecutor
{
    constructor()
    {
        this.tempDir=path.join(__dirname, '..', 'temp');
        this.ensureTempDir();
    }

    async ensureTempDir()
    {
        try
        {
            await fs.mkdir(this.tempDir, {recursive: true});
        } catch (error)
        {
            console.error('Failed to create temp directory:', error);
        }
    }

    async execute(code, language, input='')
    {
        const startTime=Date.now();
        try
        {
            if (code.length>MAX_CODE_SIZE)
            {
                throw new Error(`Code exceeds maximum size of ${MAX_CODE_SIZE/1024}KB`);
            }
            const securityCheck=this.validateCodeSecurity(code, language);
            if (!securityCheck.safe)
            {
                throw new Error(`Security violation: ${securityCheck.reason}`);
            }
            let result;
            switch (language.toLowerCase())
            {
                case 'python': result=await this.executePython(code, input); break;
                case 'javascript': case 'js': result=await this.executeJavaScript(code, input); break;
                case 'java': result=await this.executeJava(code, input); break;
                case 'cpp': case 'c++': result=await this.executeCpp(code, input); break;
                case 'c': result=await this.executeC(code, input); break;
                default: throw new Error(`Language ${language} not supported`);
            }
            const executionTime=Date.now()-startTime;
            if (result.output&&result.output.length>MAX_OUTPUT_SIZE)
            {
                result.output=result.output.substring(0, MAX_OUTPUT_SIZE)+'\n... [Output truncated]';
            }
            return {...result, executionTime};
        } catch (error)
        {
            return {output: '', errors: error.message, executionTime: Date.now()-startTime, hasError: true};
        }
    }

    validateCodeSecurity(code, language)
    {
        const dangerousPatterns={
            python: [/import\s+os/i, /import\s+subprocess/i, /import\s+sys/i, /__import__/i, /eval\(/i, /exec\(/i, /compile\(/i, /open\(/i, /file\(/i],
            javascript: [/require\s*\(/i, /import\s+/i, /eval\(/i, /Function\(/i, /child_process/i, /fs\./i, /process\./i],
            java: [/Runtime\.getRuntime/i, /ProcessBuilder/i, /java\.io\.File/i, /java\.nio\.file/i, /System\.exit/i, /Class\.forName/i],
            cpp: [/system\s*\(/i, /exec\w*\s*\(/i, /popen/i, /#include\s*<fstream>/i, /remove\s*\(/i, /rename\s*\(/i],
            c: [/system\s*\(/i, /exec\w*\s*\(/i, /popen/i, /fopen/i, /remove\s*\(/i, /rename\s*\(/i]
        };
        const lang=language.toLowerCase();
        const patterns=dangerousPatterns[lang==='c++'? 'cpp':lang]||[];
        for (const pattern of patterns)
        {
            if (pattern.test(code))
            {
                return {safe: false, reason: `Dangerous pattern detected: ${pattern.toString()}`};
            }
        }
        return {safe: true};
    }

    async executePython(code, input)
    {
        const filename=`temp_${uuidv4()}.py`;
        const filepath=path.join(this.tempDir, filename);
        try
        {
            await fs.writeFile(filepath, code);
            const result=await this.runCommand('python', [filepath], input);
            await fs.unlink(filepath).catch(() => {});
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch(() => {});
            throw error;
        }
    }

    async executeJavaScript(code, input)
    {
        const wrappedCode=`
const inputs = ${JSON.stringify(input.split('\n'))};
let inputIndex = 0;
globalThis.input = () => inputs[inputIndex++] || '';

${code}
`;
        const filename=`temp_${uuidv4()}.cjs`;
        const filepath=path.join(this.tempDir, filename);
        try
        {
            await fs.writeFile(filepath, wrappedCode);
            const result=await this.runCommand('node', [filepath], input);
            await fs.unlink(filepath).catch(() => {});
            return result;
        } catch (error)
        {
            throw error;
        }
    }

    async executeJava(code, input)
    {
        const className=this.extractJavaClassName(code)||'Main';
        const filename=`${className}.java`;
        const filepath=path.join(this.tempDir, filename);
        try
        {
            await fs.writeFile(filepath, code);
            try
            {
                execSync(`javac "${filepath}"`, {cwd: this.tempDir, timeout: MAX_EXECUTION_TIME});
            } catch (compileError)
            {
                return {output: '', errors: compileError.stderr?.toString()||compileError.message, hasError: true};
            }
            const result=await this.runCommand('java', ['-cp', this.tempDir, className], input);
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(path.join(this.tempDir, `${className}.class`)).catch(() => {});
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch(() => {});
            throw error;
        }
    }

    async executeCpp(code, input)
    {
        const filename=`temp_${uuidv4()}.cpp`;
        const filepath=path.join(this.tempDir, filename);
        const exepath=path.join(this.tempDir, `temp_${uuidv4()}.exe`);
        try
        {
            await fs.writeFile(filepath, code);
            try
            {
                execSync(`g++ "${filepath}" -o "${exepath}"`, {timeout: MAX_EXECUTION_TIME});
            } catch (compileError)
            {
                return {output: '', errors: compileError.stderr?.toString()||compileError.message, hasError: true};
            }
            const result=await this.runCommand(exepath, [], input);
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            throw error;
        }
    }

    async executeC(code, input)
    {
        const filename=`temp_${uuidv4()}.c`;
        const filepath=path.join(this.tempDir, filename);
        const exepath=path.join(this.tempDir, `temp_${uuidv4()}.exe`);
        try
        {
            await fs.writeFile(filepath, code);
            try
            {
                execSync(`gcc "${filepath}" -o "${exepath}"`, {timeout: MAX_EXECUTION_TIME});
            } catch (compileError)
            {
                return {output: '', errors: compileError.stderr?.toString()||compileError.message, hasError: true};
            }
            const result=await this.runCommand(exepath, [], input);
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            throw error;
        }
    }

    runCommand(command, args=[], input='')
    {
        return new Promise((resolve, reject) =>
        {
            const proc=spawn(command, args);
            let stdout='';
            let stderr='';
            const timeout=setTimeout(() => {proc.kill(); reject(new Error('Execution timeout'));}, MAX_EXECUTION_TIME);
            proc.stdout.on('data', (data) => {stdout+=data.toString();});
            proc.stderr.on('data', (data) => {stderr+=data.toString();});
            proc.on('close', (code) => {clearTimeout(timeout); resolve({output: stdout, errors: stderr, hasError: code!==0||stderr.length>0});});
            proc.on('error', (error) => {clearTimeout(timeout); reject(error);});
            if (input) {proc.stdin.write(input); proc.stdin.end();}
        });
    }

    async validateSyntax(code, language)
    {
        try
        {
            const result=await this.execute(code, language, '');
            return {valid: !result.hasError, errors: result.hasError? result.errors:null};
        } catch (error)
        {
            return {valid: false, errors: error.message};
        }
    }

    extractJavaClassName(code)
    {
        const match=code.match(/public\s+class\s+(\w+)/);
        return match? match[1]:null;
    }
}

export default new CodeExecutor();
