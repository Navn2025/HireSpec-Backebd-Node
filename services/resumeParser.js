/**
 * Resume Parser & ATS Scoring Service
 * Parses resumes and calculates ATS compatibility scores
 */

import {GoogleGenerativeAI} from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY||'');

// Common skill categories for matching
const SKILL_CATEGORIES={
    programming: ['javascript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'typescript', 'php', 'swift', 'kotlin'],
    frontend: ['react', 'vue', 'angular', 'html', 'css', 'sass', 'tailwind', 'bootstrap', 'nextjs', 'gatsby', 'svelte'],
    backend: ['node.js', 'express', 'django', 'flask', 'spring', 'fastapi', 'rails', 'laravel', 'asp.net'],
    database: ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'sqlite', 'oracle', 'sql server', 'dynamodb'],
    cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd', 'devops'],
    ai_ml: ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'computer vision', 'data science'],
    soft_skills: ['leadership', 'communication', 'teamwork', 'problem solving', 'analytical', 'project management']
};

/**
 * Extract text from resume file (supports PDF text extraction via AI)
 */
export async function extractResumeText(filePath)
{
    try
    {
        const fileBuffer=await fs.readFile(filePath);
        const base64Data=fileBuffer.toString('base64');
        const mimeType=filePath.endsWith('.pdf')? 'application/pdf':'application/msword';

        const model=genAI.getGenerativeModel({model: 'gemini-1.5-flash'});

        const result=await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            },
            `Extract ALL text content from this resume document. Return the complete text as-is, maintaining the structure. Include:
            - Contact information
            - Summary/Objective
            - Skills
            - Work Experience
            - Education
            - Certifications
            - Projects
            Return ONLY the extracted text, no commentary.`
        ]);

        return result.response.text();
    } catch (error)
    {
        console.error('Resume text extraction error:', error);
        throw new Error('Failed to extract text from resume');
    }
}

/**
 * Parse resume into structured data using AI
 */
export async function parseResume(resumeText)
{
    try
    {
        const model=genAI.getGenerativeModel({model: 'gemini-1.5-flash'});

        const prompt=`Analyze this resume and extract structured information. Return a valid JSON object with this exact structure:
{
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "City, State/Country",
    "linkedin": "linkedin url if present",
    "github": "github url if present",
    "portfolio": "portfolio url if present",
    "summary": "professional summary or objective",
    "skills": {
        "technical": ["skill1", "skill2"],
        "soft": ["skill1", "skill2"],
        "languages": ["English", "Spanish"],
        "tools": ["tool1", "tool2"]
    },
    "experience": [
        {
            "title": "Job Title",
            "company": "Company Name",
            "location": "Location",
            "startDate": "MM/YYYY",
            "endDate": "MM/YYYY or Present",
            "description": "Brief description",
            "achievements": ["achievement1", "achievement2"]
        }
    ],
    "education": [
        {
            "degree": "Degree Name",
            "institution": "School Name",
            "location": "Location",
            "graduationDate": "MM/YYYY",
            "gpa": "GPA if mentioned",
            "relevant_courses": ["course1", "course2"]
        }
    ],
    "certifications": [
        {
            "name": "Certification Name",
            "issuer": "Issuing Organization",
            "date": "Date",
            "id": "Certificate ID if present"
        }
    ],
    "projects": [
        {
            "name": "Project Name",
            "description": "Brief description",
            "technologies": ["tech1", "tech2"],
            "link": "project url if present"
        }
    ],
    "total_experience_years": 0
}

Resume text:
${resumeText}

Return ONLY the JSON object, no markdown formatting or code blocks.`;

        const result=await model.generateContent(prompt);
        const responseText=result.response.text().trim();

        // Clean up response - remove markdown code blocks if present
        let jsonText=responseText;
        if (jsonText.startsWith('```json'))
        {
            jsonText=jsonText.slice(7);
        } else if (jsonText.startsWith('```'))
        {
            jsonText=jsonText.slice(3);
        }
        if (jsonText.endsWith('```'))
        {
            jsonText=jsonText.slice(0, -3);
        }

        return JSON.parse(jsonText.trim());
    } catch (error)
    {
        console.error('Resume parsing error:', error);
        throw new Error('Failed to parse resume content');
    }
}

/**
 * Calculate ATS score based on job requirements
 */
export function calculateATSScore(parsedResume, jobRequirements)
{
    const scores={
        skillsMatch: 0,
        experienceMatch: 0,
        educationMatch: 0,
        keywordDensity: 0,
        formatScore: 0
    };

    const weights={
        skillsMatch: 0.35,
        experienceMatch: 0.25,
        educationMatch: 0.15,
        keywordDensity: 0.15,
        formatScore: 0.10
    };

    // Extract all resume skills
    const resumeSkills=[
        ...(parsedResume.skills?.technical||[]),
        ...(parsedResume.skills?.soft||[]),
        ...(parsedResume.skills?.tools||[])
    ].map(s => s.toLowerCase());

    // Get required skills from job
    const requiredSkills=(jobRequirements.required_skills||[]).map(s => s.toLowerCase());
    const preferredSkills=(jobRequirements.preferred_skills||[]).map(s => s.toLowerCase());

    // Skills Match Score
    if (requiredSkills.length>0)
    {
        const matchedRequired=requiredSkills.filter(skill =>
            resumeSkills.some(rs => rs.includes(skill)||skill.includes(rs))
        ).length;
        const matchedPreferred=preferredSkills.filter(skill =>
            resumeSkills.some(rs => rs.includes(skill)||skill.includes(rs))
        ).length;

        scores.skillsMatch=(
            (matchedRequired/requiredSkills.length)*0.7+
            (preferredSkills.length>0? (matchedPreferred/preferredSkills.length)*0.3:0.3)
        )*100;
    } else
    {
        scores.skillsMatch=70; // Default if no requirements specified
    }

    // Experience Match Score
    const requiredExperience=jobRequirements.min_experience_years||0;
    const candidateExperience=parsedResume.total_experience_years||0;

    if (requiredExperience===0)
    {
        scores.experienceMatch=100;
    } else if (candidateExperience>=requiredExperience)
    {
        scores.experienceMatch=100;
    } else
    {
        scores.experienceMatch=Math.max(0, (candidateExperience/requiredExperience)*100);
    }

    // Education Match Score
    const requiredEducation=(jobRequirements.required_education||'').toLowerCase();
    const candidateEducation=(parsedResume.education||[])
        .map(e => e.degree?.toLowerCase()||'')
        .join(' ');

    if (!requiredEducation)
    {
        scores.educationMatch=100;
    } else
    {
        const educationLevels=['high school', 'associate', 'bachelor', 'master', 'phd', 'doctorate'];
        const requiredLevel=educationLevels.findIndex(l => requiredEducation.includes(l));
        const candidateLevel=Math.max(
            ...educationLevels.map((l, i) => candidateEducation.includes(l)? i:-1)
        );

        if (candidateLevel>=requiredLevel)
        {
            scores.educationMatch=100;
        } else if (requiredLevel===-1)
        {
            scores.educationMatch=candidateEducation? 80:50;
        } else
        {
            scores.educationMatch=Math.max(40, 100-(requiredLevel-candidateLevel)*20);
        }
    }

    // Keyword Density Score
    const jobKeywords=(jobRequirements.keywords||[]).map(k => k.toLowerCase());
    const resumeText=JSON.stringify(parsedResume).toLowerCase();

    if (jobKeywords.length>0)
    {
        const matchedKeywords=jobKeywords.filter(kw => resumeText.includes(kw)).length;
        scores.keywordDensity=(matchedKeywords/jobKeywords.length)*100;
    } else
    {
        scores.keywordDensity=75;
    }

    // Format Score (based on completeness)
    let completenessScore=0;
    if (parsedResume.name) completenessScore+=10;
    if (parsedResume.email) completenessScore+=10;
    if (parsedResume.phone) completenessScore+=5;
    if (parsedResume.summary) completenessScore+=15;
    if ((parsedResume.skills?.technical||[]).length>0) completenessScore+=20;
    if ((parsedResume.experience||[]).length>0) completenessScore+=20;
    if ((parsedResume.education||[]).length>0) completenessScore+=15;
    if (parsedResume.linkedin||parsedResume.github) completenessScore+=5;
    scores.formatScore=completenessScore;

    // Calculate weighted total
    const totalScore=Object.keys(scores).reduce((total, key) =>
    {
        return total+(scores[key]*weights[key]);
    }, 0);

    return {
        overall_score: Math.round(totalScore),
        breakdown: {
            skills_match: Math.round(scores.skillsMatch),
            experience_match: Math.round(scores.experienceMatch),
            education_match: Math.round(scores.educationMatch),
            keyword_density: Math.round(scores.keywordDensity),
            format_completeness: Math.round(scores.formatScore)
        },
        matched_skills: resumeSkills.filter(rs =>
            [...requiredSkills, ...preferredSkills].some(s => rs.includes(s)||s.includes(rs))
        ),
        missing_skills: requiredSkills.filter(skill =>
            !resumeSkills.some(rs => rs.includes(skill)||skill.includes(rs))
        ),
        recommendations: generateRecommendations(scores, parsedResume, jobRequirements)
    };
}

/**
 * Generate improvement recommendations based on ATS analysis
 */
function generateRecommendations(scores, parsedResume, jobRequirements)
{
    const recommendations=[];

    if (scores.skillsMatch<70)
    {
        const missingSkills=(jobRequirements.required_skills||[]).filter(skill =>
            !(parsedResume.skills?.technical||[])
                .map(s => s.toLowerCase())
                .some(s => s.includes(skill.toLowerCase()))
        ).slice(0, 5);

        if (missingSkills.length>0)
        {
            recommendations.push({
                category: 'Skills',
                priority: 'high',
                message: `Add missing required skills: ${missingSkills.join(', ')}`,
                impact: 'Could increase match score by 15-25%'
            });
        }
    }

    if (scores.experienceMatch<80)
    {
        recommendations.push({
            category: 'Experience',
            priority: 'medium',
            message: 'Highlight relevant experience more prominently. Use action verbs and quantify achievements.',
            impact: 'Could increase relevance perception'
        });
    }

    if (scores.keywordDensity<60)
    {
        recommendations.push({
            category: 'Keywords',
            priority: 'high',
            message: 'Include more industry-specific keywords from the job description',
            impact: 'Could increase ATS visibility by 10-20%'
        });
    }

    if (scores.formatScore<80)
    {
        const missing=[];
        if (!parsedResume.summary) missing.push('professional summary');
        if (!parsedResume.linkedin) missing.push('LinkedIn profile');
        if ((parsedResume.skills?.technical||[]).length<5) missing.push('more technical skills');

        if (missing.length>0)
        {
            recommendations.push({
                category: 'Format',
                priority: 'low',
                message: `Consider adding: ${missing.join(', ')}`,
                impact: 'Improves resume completeness'
            });
        }
    }

    return recommendations;
}

/**
 * Rank multiple candidates based on ATS scores for a job
 */
export function rankCandidates(candidates, jobRequirements)
{
    const rankedCandidates=candidates.map(candidate =>
    {
        const atsScore=calculateATSScore(candidate.parsed_resume, jobRequirements);
        return {
            ...candidate,
            ats_score: atsScore.overall_score,
            ats_breakdown: atsScore.breakdown,
            matched_skills: atsScore.matched_skills,
            missing_skills: atsScore.missing_skills,
            recommendations: atsScore.recommendations
        };
    });

    // Sort by ATS score (descending)
    rankedCandidates.sort((a, b) => b.ats_score-a.ats_score);

    // Add ranking
    return rankedCandidates.map((candidate, index) => ({
        ...candidate,
        rank: index+1,
        status: getRecommendationStatus(candidate.ats_score)
    }));
}

/**
 * Get recommendation status based on ATS score
 */
function getRecommendationStatus(score)
{
    if (score>=80) return 'highly_recommended';
    if (score>=65) return 'recommended';
    if (score>=50) return 'consider';
    if (score>=35) return 'below_threshold';
    return 'not_recommended';
}

/**
 * Generate detailed AI analysis of resume for a specific job
 */
export async function generateDetailedAnalysis(parsedResume, jobRequirements)
{
    try
    {
        const model=genAI.getGenerativeModel({model: 'gemini-1.5-flash'});

        const prompt=`Analyze this candidate's resume for the specified job position and provide a detailed assessment.

CANDIDATE RESUME:
${JSON.stringify(parsedResume, null, 2)}

JOB REQUIREMENTS:
- Title: ${jobRequirements.title||'Not specified'}
- Required Skills: ${(jobRequirements.required_skills||[]).join(', ')||'Not specified'}
- Preferred Skills: ${(jobRequirements.preferred_skills||[]).join(', ')||'Not specified'}
- Experience Required: ${jobRequirements.min_experience_years||0} years
- Education: ${jobRequirements.required_education||'Not specified'}
- Description: ${jobRequirements.description||'Not specified'}

Provide a JSON response with this structure:
{
    "overall_fit": "excellent/good/moderate/poor",
    "strengths": ["strength1", "strength2", "strength3"],
    "weaknesses": ["weakness1", "weakness2"],
    "experience_relevance": {
        "score": 0-100,
        "analysis": "Detailed analysis of experience relevance"
    },
    "skill_gaps": ["gap1", "gap2"],
    "culture_fit_indicators": ["indicator1", "indicator2"],
    "interview_focus_areas": ["area1", "area2", "area3"],
    "salary_range_estimate": "Based on experience and skills",
    "summary": "2-3 sentence overall assessment"
}

Return ONLY the JSON object.`;

        const result=await model.generateContent(prompt);
        const responseText=result.response.text().trim();

        let jsonText=responseText;
        if (jsonText.startsWith('```json')) jsonText=jsonText.slice(7);
        else if (jsonText.startsWith('```')) jsonText=jsonText.slice(3);
        if (jsonText.endsWith('```')) jsonText=jsonText.slice(0, -3);

        return JSON.parse(jsonText.trim());
    } catch (error)
    {
        console.error('Detailed analysis error:', error);
        return {
            overall_fit: 'unknown',
            strengths: ['Unable to analyze'],
            weaknesses: [],
            summary: 'Analysis could not be completed'
        };
    }
}

export default {
    extractResumeText,
    parseResume,
    calculateATSScore,
    rankCandidates,
    generateDetailedAnalysis
};
