/**
 * AI LEARNING IMPACT SERVICE
 * - Generates matched Pre- and Post-assessments for a session's skill & objectives
 * - Uses Gemini API (@google/genai, gemini-3.8-flash) for questions & descriptive feedback
 * - Uses deterministic answer keys and rubrics for objective items & tasks
 * - Validates consistent 0-100 scale, topic-wise deltas, and non-fabricated reports
 */

const { GoogleGenAI } = require("@google/genai");

class LearningImpactService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                this.aiClient = new GoogleGenAI({ apiKey });
            } catch (err) {
                console.warn("Gemini SDK note in LearningImpactService:", err.message);
                this.aiClient = null;
            }
        } else {
            this.aiClient = null;
        }
    }

    /**
     * Derives default learning objectives based on skill and session topic
     */
    deriveObjectives(skill, topic) {
        const cleanSkill = (skill || "Technical Skill").trim();
        const cleanTopic = (topic || cleanSkill).trim();

        return [
            `Core principles & fundamental mechanisms of ${cleanTopic}`,
            `Syntax, state management, or execution flow in ${cleanSkill}`,
            `Practical implementation and defensive error handling for ${cleanTopic}`,
            `Best practices, common pitfalls, and edge-case resolution`
        ];
    }

    /**
     * Generates an assessment set (Pre or Post) containing 4 questions:
     * - 2 MCQs (25 pts each = 50 pts)
     * - 1 Conceptual (25 pts)
     * - 1 Practical Task (25 pts)
     * Total = 100 points
     */
    async generateSessionAssessment({ stage, skill, topic, learningObjectives }) {
        const stageLabel = stage === "pre" ? "Pre-Session Baseline" : "Post-Session Mastery";
        const objectivesList = (learningObjectives && learningObjectives.length > 0)
            ? learningObjectives
            : this.deriveObjectives(skill, topic);

        // Try AI generation first with strict structured JSON schema
        if (this.aiClient) {
            try {
                const prompt = `You are an educational assessment architect creating a ${stageLabel} assessment for a learner in a 1-on-1 tutoring session.
Skill: "${skill}"
Topic/Focus: "${topic || skill}"
Learning Objectives:
${objectivesList.map((o, idx) => `${idx + 1}. ${o}`).join("\n")}
Assessment Stage: ${stage.toUpperCase()} (${stage === "pre" ? "diagnostic baseline before session" : "evaluating learning gain after session - new questions covering the same objectives at equal difficulty"}).

Generate exactly 4 questions (Total = 100 points):
1. MCQ Question (Topic: Foundational Principles, 25 points, beginner-to-intermediate):
   - Exactly 4 options A), B), C), D)
   - exactly one integer correctOptionIndex (0, 1, 2, or 3)
   - clear explanation
2. MCQ Question (Topic: Implementation & Architecture, 25 points, intermediate):
   - Exactly 4 options A), B), C), D)
   - exactly one integer correctOptionIndex (0, 1, 2, or 3)
   - clear explanation
3. Conceptual Question (Topic: Conceptual Depth & Mental Model, 25 points):
   - explanatory prompt testing understanding of mechanisms and trade-offs
   - 3-4 specific expectedKeyConcepts for grading
4. Practical Task Question (Topic: Practical Application, 25 points):
   - coding or hands-on problem solving task with explicit inputs/outputs
   - 3-4 specific expectedKeyConcepts
   - 3-4 sampleCodeCheck keywords

Return STRICT JSON matching:
{
  "title": "${skill} ${stageLabel} Assessment",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "topic": "Foundational Principles",
      "maxPoints": 25,
      "question": "question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctOptionIndex": 0,
      "explanation": "why this is correct"
    },
    {
      "id": 2,
      "type": "mcq",
      "topic": "Implementation & Architecture",
      "maxPoints": 25,
      "question": "question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctOptionIndex": 1,
      "explanation": "why this is correct"
    },
    {
      "id": 3,
      "type": "conceptual",
      "topic": "Conceptual Depth",
      "maxPoints": 25,
      "question": "explain ...",
      "expectedKeyConcepts": ["concept1", "concept2", "concept3"]
    },
    {
      "id": 4,
      "type": "practical",
      "topic": "Practical Application",
      "maxPoints": 25,
      "question": "write code or design ...",
      "expectedKeyConcepts": ["concept1", "concept2", "concept3"],
      "sampleCodeCheck": ["word1", "word2"]
    }
  ]
}`;

                const response = await this.aiClient.models.generateContent({
                    model: "gemini-3.8-flash",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json"
                    }
                });

                if (response && response.text) {
                    const parsed = JSON.parse(response.text);
                    if (parsed.questions && parsed.questions.length === 4) {
                        return {
                            stage,
                            skill,
                            topic: topic || skill,
                            learningObjectives: objectivesList,
                            title: parsed.title || `${skill} ${stageLabel}`,
                            questions: parsed.questions.map(q => ({
                                id: q.id,
                                type: q.type,
                                topic: q.topic || "Core Concept",
                                maxPoints: q.maxPoints || 25,
                                question: q.question,
                                options: q.options || [],
                                sampleCodeCheck: q.sampleCodeCheck || []
                            })),
                            internalBenchmark: parsed
                        };
                    }
                }
            } catch (err) {
                console.warn("AI generation in LearningImpact fallback triggered:", err.message);
            }
        }

        // Deterministic fallback assessment
        return this.createDeterministicAssessment(stage, skill, topic, objectivesList);
    }

    createDeterministicAssessment(stage, skill, topic, objectives) {
        const isPre = stage === "pre";
        const stageLabel = isPre ? "Pre-Session Baseline" : "Post-Session Mastery";

        const q1 = isPre
            ? {
                id: 1,
                type: "mcq",
                topic: "Foundational Principles",
                maxPoints: 25,
                question: `In ${skill}, what is the foundational mental model for handling execution flow and module organization?`,
                options: [
                    "A) Code executes unpredictably without deterministic scoping.",
                    "B) Components/modules encapsulate logic and communicate via structured interfaces and parameters.",
                    "C) All state must be shared globally without encapsulation.",
                    "D) Modules must be rewritten from scratch after each execution."
                ],
                correctOptionIndex: 1,
                explanation: "Encapsulation and clear interface contracts form the backbone of modern development."
            }
            : {
                id: 1,
                type: "mcq",
                topic: "Foundational Principles",
                maxPoints: 25,
                question: `Following your session on ${topic || skill}, what is the primary benefit of deterministic lifecycle management and pure operations?`,
                options: [
                    "A) Eliminates unexpected side-effects and makes testing predictable.",
                    "B) Increases memory usage by duplicating variables unconditionally.",
                    "C) Disables asynchronous event processing.",
                    "D) Prevents modules from being reused."
                ],
                correctOptionIndex: 0,
                explanation: "Pure operations and clear lifecycles minimize side-effects and maximize testability."
            };

        const q2 = isPre
            ? {
                id: 2,
                type: "mcq",
                topic: "Implementation & Architecture",
                maxPoints: 25,
                question: `When designing a feature in ${skill}, how should unexpected errors or exceptions be defensively handled?`,
                options: [
                    "A) Suppress all errors silently without logging.",
                    "B) Let the entire runtime process crash immediately on any error.",
                    "C) Catch exceptions at domain boundaries, log context, and return safe fallback states or structured error codes.",
                    "D) Hardcode retry loops that never terminate."
                ],
                correctOptionIndex: 2,
                explanation: "Defensive boundary handling and contextual logging ensure system resilience."
            }
            : {
                id: 2,
                type: "mcq",
                topic: "Implementation & Architecture",
                maxPoints: 25,
                question: `In modern ${skill} architecture, what is the best practice for managing data synchronization between multiple modules?`,
                options: [
                    "A) Directly mutating global variables without event notifications.",
                    "B) Single source of truth with explicit unidirectional data flow or event-driven updates.",
                    "C) Poll local storage on an infinite loop with zero delay.",
                    "D) Disabling validations before persisting state."
                ],
                correctOptionIndex: 1,
                explanation: "Unidirectional data flow maintains a single source of truth, avoiding state desynchronization."
            };

        const q3 = {
            id: 3,
            type: "conceptual",
            topic: "Conceptual Depth",
            maxPoints: 25,
            question: isPre
                ? `Explain the core principles of ${topic || skill}. What are the primary mechanisms, what challenges do beginners commonly face, and how do you solve them?`
                : `Deep-dive into the concepts explored during your session on ${topic || skill}. Explain how the mechanisms interact, the performance trade-offs, and an architectural pattern you would recommend.`,
            expectedKeyConcepts: [
                "underlying mental model and execution lifecycle",
                "trade-offs and performance considerations",
                "defensive design and common failure modes",
                "real-world application scenario"
            ]
        };

        const q4 = {
            id: 4,
            type: "practical",
            topic: "Practical Application",
            maxPoints: 25,
            question: isPre
                ? `Write or outline a basic implementation for ${topic || skill}. Detail the key function/class signatures, input validation, and expected output.`
                : `Implement a robust, production-ready solution for ${topic || skill} that includes input validation, error handling, and clean modular structure.`,
            expectedKeyConcepts: [
                "working code or structure with appropriate syntax",
                "input validation and edge-case handling",
                "clean return values or state transitions"
            ],
            sampleCodeCheck: ["function", "return", "error", "try"]
        };

        const questions = [q1, q2, q3, q4];

        return {
            stage,
            skill,
            topic: topic || skill,
            learningObjectives: objectives,
            title: `${skill} ${stageLabel}`,
            questions: questions.map(q => ({
                id: q.id,
                type: q.type,
                topic: q.topic,
                maxPoints: q.maxPoints,
                question: q.question,
                options: q.options || [],
                sampleCodeCheck: q.sampleCodeCheck || []
            })),
            internalBenchmark: { title: `${skill} ${stageLabel}`, questions }
        };
    }

    /**
     * Evaluates Pre or Post answers against the internal benchmark
     */
    async evaluateAnswers({ stage, skill, answers, internalBenchmark }) {
        const questions = internalBenchmark.questions || [];
        const answersRecord = [];
        let totalScore = 0;

        const topicScores = {};

        for (const q of questions) {
            const userAns = answers[q.id];
            let awarded = 0;
            let isCorrect = false;
            let feedback = "";

            if (q.type === "mcq") {
                isCorrect = userAns !== undefined && parseInt(userAns, 10) === q.correctOptionIndex;
                awarded = isCorrect ? q.maxPoints : 0;
                feedback = isCorrect
                    ? "Correct answer."
                    : `Incorrect. ${q.explanation || ""}`;
            } else if (q.type === "conceptual") {
                const text = (userAns || "").trim();
                const evalRes = await this.scoreDescriptiveAnswer(skill, q.question, q.expectedKeyConcepts || [], text, q.maxPoints);
                awarded = evalRes.points;
                isCorrect = awarded >= (q.maxPoints * 0.6);
                feedback = evalRes.feedback;
            } else if (q.type === "practical") {
                const codeText = (userAns || "").trim();
                const evalRes = await this.scorePracticalAnswer(skill, q.question, q.sampleCodeCheck || [], codeText, q.maxPoints);
                awarded = evalRes.points;
                isCorrect = awarded >= (q.maxPoints * 0.6);
                feedback = evalRes.feedback;
            }

            totalScore += awarded;

            topicScores[q.topic] = topicScores[q.topic] || { awarded: 0, max: 0 };
            topicScores[q.topic].awarded += awarded;
            topicScores[q.topic].max += q.maxPoints;

            answersRecord.push({
                questionId: q.id,
                questionType: q.type,
                topic: q.topic,
                questionText: q.question,
                userAnswer: typeof userAns === "string" ? userAns : (userAns !== undefined ? `Option ${userAns}` : "Unanswered"),
                isCorrect,
                pointsAwarded: awarded,
                maxPoints: q.maxPoints,
                feedback
            });
        }

        totalScore = Math.min(100, Math.max(0, totalScore));

        return {
            score: totalScore,
            answersRecord,
            topicScores
        };
    }

    async scoreDescriptiveAnswer(skill, question, expectedKeyConcepts, userAnswer, maxPoints) {
        if (!userAnswer || userAnswer.length < 15) {
            return { points: 0, feedback: "Response lacked substantive explanation." };
        }

        const lower = userAnswer.toLowerCase();
        let matched = 0;
        for (const concept of expectedKeyConcepts) {
            const tokens = concept.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            if (tokens.some(t => lower.includes(t))) matched++;
        }

        const deterministic = Math.round((matched / Math.max(1, expectedKeyConcepts.length)) * maxPoints);

        if (this.aiClient) {
            try {
                const prompt = `Grade this conceptual answer for skill "${skill}". Max points: ${maxPoints}.
Question: "${question}"
Key rubric concepts:
${expectedKeyConcepts.map(c => `- ${c}`).join("\n")}

Student answer:
"""${userAnswer}"""

Score strictly from 0 to ${maxPoints} based on understanding and depth.
Return JSON: { "points": <integer>, "feedback": "<one concise sentence>" }`;

                const res = await this.aiClient.models.generateContent({
                    model: "gemini-3.8-flash",
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });

                if (res && res.text) {
                    const parsed = JSON.parse(res.text);
                    const aiPts = Math.min(maxPoints, Math.max(0, parseInt(parsed.points, 10) || 0));
                    const blended = Math.round((deterministic * 0.4) + (aiPts * 0.6));
                    return { points: blended, feedback: parsed.feedback || "Conceptual comprehension verified." };
                }
            } catch (err) {
                console.warn("AI descriptive grading in impact service:", err.message);
            }
        }

        return {
            points: Math.min(maxPoints, Math.max(5, deterministic)),
            feedback: `Identified ${matched} of ${expectedKeyConcepts.length} core concepts.`
        };
    }

    async scorePracticalAnswer(skill, question, sampleCodeCheck, userAnswer, maxPoints) {
        if (!userAnswer || userAnswer.length < 15) {
            return { points: 0, feedback: "No implementation solution provided." };
        }

        const lower = userAnswer.toLowerCase();
        let tokenMatches = 0;
        for (const token of sampleCodeCheck) {
            if (lower.includes(token.toLowerCase())) tokenMatches++;
        }

        const deterministic = Math.round((tokenMatches / Math.max(1, sampleCodeCheck.length || 1)) * maxPoints);

        if (this.aiClient) {
            try {
                const prompt = `Grade this practical code task for skill "${skill}". Max points: ${maxPoints}.
Task: "${question}"
Candidate code:
"""${userAnswer}"""

Evaluate syntax, logic flow, and edge cases. Score from 0 to ${maxPoints}.
Return JSON: { "points": <integer>, "feedback": "<one concise sentence>" }`;

                const res = await this.aiClient.models.generateContent({
                    model: "gemini-3.8-flash",
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });

                if (res && res.text) {
                    const parsed = JSON.parse(res.text);
                    const aiPts = Math.min(maxPoints, Math.max(0, parseInt(parsed.points, 10) || 0));
                    const blended = Math.round((deterministic * 0.4) + (aiPts * 0.6));
                    return { points: blended, feedback: parsed.feedback || "Practical implementation reviewed." };
                }
            } catch (err) {
                console.warn("AI practical grading in impact service:", err.message);
            }
        }

        return {
            points: Math.min(maxPoints, Math.max(5, deterministic)),
            feedback: "Foundational implementation logic present."
        };
    }

    /**
     * Synthesizes Pre vs Post scores into a comparative Learning Impact Report
     */
    synthesizeImpactReport({ preAssessment, postAssessment, skill, learningObjectives }) {
        const preScore = preAssessment.score;
        const postScore = postAssessment.score;
        const percentagePointChange = postScore - preScore;

        // Group topics and measure growth
        const topicMap = {};

        (preAssessment.answers || []).forEach(a => {
            topicMap[a.topic] = topicMap[a.topic] || { preTotal: 0, postTotal: 0, maxPoints: a.maxPoints };
            topicMap[a.topic].preTotal += a.pointsAwarded;
        });

        (postAssessment.answers || []).forEach(a => {
            topicMap[a.topic] = topicMap[a.topic] || { preTotal: 0, postTotal: 0, maxPoints: a.maxPoints };
            topicMap[a.topic].postTotal += a.pointsAwarded;
        });

        const topicResults = [];
        const demonstratedStrengths = [];
        const topicsNeedingPractice = [];
        const recommendedNextExercises = [];

        for (const [topicName, data] of Object.entries(topicMap)) {
            const prePercent = Math.round((data.preTotal / data.maxPoints) * 100);
            const postPercent = Math.round((data.postTotal / data.maxPoints) * 100);
            const delta = postPercent - prePercent;

            let status = "Needs Practice";
            if (postPercent >= 80) {
                status = "Mastered";
                demonstratedStrengths.push(`${topicName} (${postPercent}% post-session proficiency)`);
            } else if (delta > 0) {
                status = "Improved";
                demonstratedStrengths.push(`${topicName} (+${delta}% learning progression)`);
            } else {
                status = "Needs Practice";
                topicsNeedingPractice.push(`${topicName} (scored ${postPercent}%)`);
                recommendedNextExercises.push(`Interactive practice module focusing on ${topicName} in ${skill}`);
            }

            topicResults.push({
                topic: topicName,
                preScore: prePercent,
                postScore: postPercent,
                change: delta,
                status
            });
        }

        if (recommendedNextExercises.length === 0) {
            recommendedNextExercises.push(`Advanced design challenge building a production feature in ${skill}`);
            recommendedNextExercises.push(`Peer code review session testing performance limits in ${skill}`);
        }

        let growthSummary = "";
        if (percentagePointChange > 0) {
            growthSummary = `Demonstrated an overall improvement of +${percentagePointChange} percentage points between pre-session baseline (${preScore}/100) and post-session evaluation (${postScore}/100).`;
        } else if (percentagePointChange === 0) {
            growthSummary = `Maintained steady performance at ${postScore}/100 across both pre- and post-assessments.`;
        } else {
            growthSummary = `Post-assessment score (${postScore}/100) vs baseline (${preScore}/100) highlights targeted areas that will benefit from further follow-up sessions.`;
        }

        // Check proctoring telemetry flags for both stages
        const preFlagged = Boolean(preAssessment.proctoring && preAssessment.proctoring.isFlaggedForReview);
        const postFlagged = Boolean(postAssessment.proctoring && postAssessment.proctoring.isFlaggedForReview);
        const isProvisional = preFlagged || postFlagged;

        let reviewNotice = "";
        if (isProvisional) {
            const reasons = [];
            if (preFlagged) reasons.push(`Pre-assessment (${preAssessment.proctoring.flagReason || "Environmental interruptions"})`);
            if (postFlagged) reasons.push(`Post-assessment (${postAssessment.proctoring.flagReason || "Environmental interruptions"})`);
            reviewNotice = `Provisional Report: This learning gain analysis is pending authorized verification due to proctoring alerts recorded during: ${reasons.join("; ")}.`;
        }

        return {
            status: isProvisional ? "provisional_review" : "analyzed",
            isProvisional,
            reviewNotice,
            preScore,
            postScore,
            percentagePointChange,
            growthSummary,
            topicResults,
            demonstratedStrengths: demonstratedStrengths.slice(0, 4),
            topicsNeedingPractice: topicsNeedingPractice.slice(0, 4),
            recommendedNextExercises: recommendedNextExercises.slice(0, 3),
            reliabilityDisclaimer: "This learning impact analysis reflects relative score changes across live AI-proctored pre- and post-assessments under identical environmental conditions. It is an indicative measure of session comprehension and does not guarantee complete subject mastery or certification."
        };
    }
}

const learningImpactService = new LearningImpactService();

module.exports = {
    learningImpactService,
    LearningImpactService
};
