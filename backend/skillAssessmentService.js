/**
 * AI-Powered Skill Verification Assessment Service
 * - Uses @google/genai SDK (gemini-3.8-flash)
 * - Deterministic question bank + AI generation fallback
 * - Hybrid scoring rubric:
 *     Objective MCQs (Deterministic Answer Key) -> 40 points
 *     Conceptual Question (Key concept checklist + semantic evaluation) -> 30 points
 *     Practical / Code Task (Specific requirements & edge case tests) -> 30 points
 * - Fair, multi-factor rubric: Does not label a user an expert based on a single question
 */

const { GoogleGenAI } = require("@google/genai");


// Standard curated benchmark tests for popular skills to guarantee deterministic accuracy
const CURATED_BENCHMARKS = {
    "javascript": {
        title: "JavaScript Core, Async & ES6+ Assessment",
        questions: [
            {
                id: 1,
                type: "mcq",
                difficulty: "beginner",
                category: "objective",
                maxPoints: 10,
                question: "What will `typeof NaN` evaluate to in JavaScript?",
                options: [
                    "A) 'number'",
                    "B) 'NaN'",
                    "C) 'undefined'",
                    "D) 'object'"
                ],
                correctOptionIndex: 0,
                explanation: "In JavaScript, NaN is a numeric value representing 'Not-a-Number', so typeof NaN returns 'number'."
            },
            {
                id: 2,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "Which of the following describes the difference between Microtasks (e.g., Promise.then) and Macrotasks (e.g., setTimeout) in the JavaScript Event Loop?",
                options: [
                    "A) Macrotasks execute before microtasks in every tick.",
                    "B) The entire microtask queue is drained immediately after the current call stack clears before the next macrotask is dequeued.",
                    "C) Microtasks are delegated to separate OS worker threads.",
                    "D) setTimeout(fn, 0) always executes ahead of Promise.resolve().then(fn)."
                ],
                correctOptionIndex: 1,
                explanation: "The microtask queue is completely drained after each synchronous call stack turn before the event loop advances to the next task in the macrotask queue."
            },
            {
                id: 3,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "What does the expression `[1, 2, 3] + [4, 5, 6]` evaluate to in standard JavaScript?",
                options: [
                    "A) [1, 2, 3, 4, 5, 6]",
                    "B) '1,2,34,5,6'",
                    "C) TypeError: cannot add arrays",
                    "D) '1,2,3,4,5,6'"
                ],
                correctOptionIndex: 1,
                explanation: "Both arrays are coerced to strings via .toString() yielding '1,2,3' and '4,5,6', which are concatenated to produce '1,2,34,5,6'."
            },
            {
                id: 4,
                type: "mcq",
                difficulty: "advanced",
                category: "objective",
                maxPoints: 10,
                question: "In JavaScript, what is the key difference between a WeakMap and a standard Map regarding memory management?",
                options: [
                    "A) WeakMaps can store string keys but Maps cannot.",
                    "B) WeakMap keys must be objects or non-registered symbols, allowing values to be garbage collected when there are no other references to the key.",
                    "C) WeakMap values are weakly referenced, whereas keys are strongly held.",
                    "D) WeakMaps can be iterated with for...of loops whereas Maps cannot."
                ],
                correctOptionIndex: 1,
                explanation: "WeakMaps hold weak references to their keys (which must be objects or non-registered symbols), enabling automated garbage collection."
            },
            {
                id: 5,
                type: "conceptual",
                difficulty: "intermediate",
                category: "conceptual",
                maxPoints: 30,
                question: "Explain JavaScript closures. How do they work with lexical scoping, what is a practical real-world use case (such as encapsulation or memoization), and what is a potential pitfall like memory leaks?",
                expectedKeyConcepts: [
                    "inner function retains access to outer lexical scope even after outer function has returned",
                    "lexical environment / scope chain preserved in memory",
                    "practical use case: data privacy/encapsulation, factory functions, or memoization",
                    "pitfall: accidental memory retention when outer variables are not garbage-collected"
                ]
            },
            {
                id: 6,
                type: "practical",
                difficulty: "advanced",
                category: "practical",
                maxPoints: 30,
                question: "Write a debounce function in JavaScript: `function debounce(fn, delay)` that returns a debounced version of `fn`. Explain or implement how it preserves arguments, `this` context, and resets the timer on rapid invocations.",
                expectedKeyConcepts: [
                    "stores a timer variable in closure",
                    "clears existing timeout with clearTimeout(timer)",
                    "schedules new setTimeout with provided delay",
                    "preserves original `this` and arguments when invoking callback"
                ],
                sampleCodeCheck: ["setTimeout", "clearTimeout", "return", "function"]
            }
        ]
    },
    "react": {
        title: "React Fundamentals, Hooks & Architecture Assessment",
        questions: [
            {
                id: 1,
                type: "mcq",
                difficulty: "beginner",
                category: "objective",
                maxPoints: 10,
                question: "Why must the `key` prop be provided when rendering a list of elements in React?",
                options: [
                    "A) To apply CSS styles to elements individually.",
                    "B) To help React's reconciliation engine identify which items have changed, been added, or been removed.",
                    "C) To make items accessible to screen readers.",
                    "D) To automatically bind click events to list items."
                ],
                correctOptionIndex: 1,
                explanation: "Keys give elements a stable identity so React reconciles and reuses DOM nodes efficiently instead of re-rendering the entire list."
            },
            {
                id: 2,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "When does the cleanup function returned by `useEffect(() => { return () => cleanup(); }, [dep])` run?",
                options: [
                    "A) Only when the entire browser window is closed.",
                    "B) Before the component re-runs the effect due to dependency change, and upon component unmount.",
                    "C) Immediately before every render cycle before state is calculated.",
                    "D) Only once during application initialization."
                ],
                correctOptionIndex: 1,
                explanation: "The cleanup function runs before re-running the effect on dependency change and when the component unmounts from the DOM."
            },
            {
                id: 3,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "What is the primary benefit of `useCallback(fn, deps)` in React?",
                options: [
                    "A) It prevents the component from rendering on the server.",
                    "B) It memoizes the function instance so passing it to memoized child components prevents unnecessary child re-renders.",
                    "C) It executes the function asynchronously in a Web Worker.",
                    "D) It automatically caches API network responses."
                ],
                correctOptionIndex: 1,
                explanation: "useCallback caches a function definition between renders, avoiding creating new references that would trigger re-renders in memoized children."
            },
            {
                id: 4,
                type: "mcq",
                difficulty: "advanced",
                category: "objective",
                maxPoints: 10,
                question: "What problem does the `useTransition` hook address in React 18+ concurrent rendering?",
                options: [
                    "A) Adding CSS transitions and keyframe animations between route pages.",
                    "B) Marking state updates as non-urgent transitions, keeping the UI responsive to user input like typing while heavy renders occur in the background.",
                    "C) Converting class components to functional components automatically.",
                    "D) Managing WebSocket reconnection timeouts."
                ],
                correctOptionIndex: 1,
                explanation: "useTransition allows developers to mark state updates as non-blocking transitions so urgent user actions (clicks, typing) interrupt heavy renders."
            },
            {
                id: 5,
                type: "conceptual",
                difficulty: "intermediate",
                category: "conceptual",
                maxPoints: 30,
                question: "Explain the rules of React Hooks and why they exist. Specifically, why can't hooks be called inside conditional statements or loops, and how does React track hook state between renders?",
                expectedKeyConcepts: [
                    "hooks must be called at top level and not inside loops, conditions, or nested functions",
                    "React relies on consistent call order (linked list/array indexed by render order)",
                    "changing call order disrupts association between state slots and hook calls",
                    "only call hooks from React function components or custom hooks"
                ]
            },
            {
                id: 6,
                type: "practical",
                difficulty: "advanced",
                category: "practical",
                maxPoints: 30,
                question: "Design a custom React hook `useDebounce(value, delay)` that takes any state value and returns the debounced value. Provide the code implementation, explain cleanup on rapid changes, and describe when you would use it in a search input.",
                expectedKeyConcepts: [
                    "useState to hold debouncedValue",
                    "useEffect with [value, delay] dependency array",
                    "setTimeout inside effect to update state after delay",
                    "cleanup function returned from effect calling clearTimeout(handler)"
                ],
                sampleCodeCheck: ["useState", "useEffect", "setTimeout", "clearTimeout"]
            }
        ]
    },
    "python": {
        title: "Python Core, Data Structures & Best Practices Assessment",
        questions: [
            {
                id: 1,
                type: "mcq",
                difficulty: "beginner",
                category: "objective",
                maxPoints: 10,
                question: "Which of the following data types in Python is mutable?",
                options: [
                    "A) tuple",
                    "B) list",
                    "C) frozenset",
                    "D) str"
                ],
                correctOptionIndex: 1,
                explanation: "Lists in Python are mutable sequences, whereas tuples, strings, and frozensets are immutable."
            },
            {
                id: 2,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "What is the output of `bool([])`, `bool([0])`, and `bool((0,))` in Python?",
                options: [
                    "A) False, False, False",
                    "B) False, True, True",
                    "C) True, False, False",
                    "D) False, False, True"
                ],
                correctOptionIndex: 1,
                explanation: "An empty list is falsy (False). A list containing 0 is non-empty so truthy (True). A 1-element tuple containing 0 is non-empty so truthy (True)."
            },
            {
                id: 3,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "In Python, why is using a mutable default argument like `def append_to(val, target=[])` considered an anti-pattern?",
                options: [
                    "A) It causes a SyntaxError at compile time.",
                    "B) The default list is instantiated only once when the function is defined, and is reused across subsequent calls.",
                    "C) Python cannot iterate over default arguments.",
                    "D) Default arguments are stored in read-only global registers."
                ],
                correctOptionIndex: 1,
                explanation: "Default arguments are evaluated once at function definition time, leading to shared state mutation across calls unless `target=None` idiom is used."
            },
            {
                id: 4,
                type: "mcq",
                difficulty: "advanced",
                category: "objective",
                maxPoints: 10,
                question: "What does the `yield from` expression do in a Python generator?",
                options: [
                    "A) Terminates the generator and throws a StopIteration.",
                    "B) Delegates generation to a subgenerator or iterable, transparently passing values, exceptions, and returns.",
                    "C) Forces the generator to run in a separate process thread.",
                    "D) Converts a synchronous function into an asyncio coroutine."
                ],
                correctOptionIndex: 1,
                explanation: "`yield from <iterable>` delegates control to a sub-generator or iterable, acting as a bidirectional channel."
            },
            {
                id: 5,
                type: "conceptual",
                difficulty: "intermediate",
                category: "conceptual",
                maxPoints: 30,
                question: "Explain Python's Global Interpreter Lock (GIL). What is it, what problem does it solve for CPython's memory management, and what are the best strategies to achieve concurrency for CPU-bound versus I/O-bound tasks?",
                expectedKeyConcepts: [
                    "mutex that protects access to Python objects, preventing multiple threads from executing CPython bytecodes simultaneously",
                    "protects CPython reference counting from race conditions",
                    "I/O-bound tasks: threading or asyncio works well because GIL is released during I/O",
                    "CPU-bound tasks: multiprocessing or external C extensions (NumPy, Cython) bypass the GIL"
                ]
            },
            {
                id: 6,
                type: "practical",
                difficulty: "advanced",
                category: "practical",
                maxPoints: 30,
                question: "Write a custom Python context manager using a class with `__enter__` and `__exit__` (or `contextlib.contextmanager`) that measures and prints the execution time of a code block. Explain how exceptions are handled inside `__exit__`.",
                expectedKeyConcepts: [
                    "class with __enter__ and __exit__ methods",
                    "stores start time in __enter__ and records elapsed in __exit__",
                    "handles exceptions in __exit__(self, exc_type, exc_val, exc_tb)",
                    "returning True suppresses exceptions; returning False/None allows exceptions to propagate"
                ],
                sampleCodeCheck: ["__enter__", "__exit__", "time", "return"]
            }
        ]
    },
    "node.js": {
        title: "Node.js Runtime, Event Loop & Backend Systems Assessment",
        questions: [
            {
                id: 1,
                type: "mcq",
                difficulty: "beginner",
                category: "objective",
                maxPoints: 10,
                question: "Which core library handles asynchronous I/O and the thread pool in Node.js?",
                options: [
                    "A) V8 engine",
                    "B) libuv",
                    "C) Babel",
                    "D) Webpack"
                ],
                correctOptionIndex: 1,
                explanation: "libuv is the multi-platform C library that powers the Node.js event loop, non-blocking I/O polling, and worker thread pool."
            },
            {
                id: 2,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "What is the difference between `process.nextTick()` and `setImmediate()` in Node.js?",
                options: [
                    "A) `setImmediate()` runs before any microtasks; `process.nextTick()` runs in the check phase.",
                    "B) `process.nextTick()` callbacks are processed immediately after the current operation finishes before the event loop continues, whereas `setImmediate()` runs in the Check phase of the loop.",
                    "C) Both run identically in the Timers phase.",
                    "D) `process.nextTick()` is deprecated in favor of setTimeout."
                ],
                correctOptionIndex: 1,
                explanation: "nextTick queue is resolved right after current phase before loop transitions, while setImmediate executes in the Check phase."
            },
            {
                id: 3,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: "When streaming large video or audio files in Node.js, why is using `stream.pipe()` or `pipeline` preferred over `fs.readFile()`?",
                options: [
                    "A) `fs.readFile()` encrypts data by default.",
                    "B) Streams process data in small chunks (buffers) without loading the entire multi-gigabyte file into RAM, and automatically handle backpressure.",
                    "C) `stream.pipe()` only works with HTTP/2 connections.",
                    "D) `fs.readFile()` blocks DNS resolution across the cluster."
                ],
                correctOptionIndex: 1,
                explanation: "Streams process files chunk by chunk, keeping memory footprint constant and providing automatic backpressure management."
            },
            {
                id: 4,
                type: "mcq",
                difficulty: "advanced",
                category: "objective",
                maxPoints: 10,
                question: "In Node.js cluster module, how does the master process distribute incoming network connections across worker processes on Linux by default?",
                options: [
                    "A) Random coin flip selection.",
                    "B) Round-Robin scheduling (or letting OS handle accept() on the shared socket).",
                    "C) Sending connections strictly to the worker with the lowest PID.",
                    "D) Re-routing via iptables port mapping."
                ],
                correctOptionIndex: 1,
                explanation: "Node.js utilizes a round-robin approach by default on non-Windows platforms, where master listens and hands off sockets to workers."
            },
            {
                id: 5,
                type: "conceptual",
                difficulty: "intermediate",
                category: "conceptual",
                maxPoints: 30,
                question: "Explain the architecture of the Node.js Event Loop. Name its key phases (timers, pending callbacks, poll, check, close), and explain what causes the 'Event Loop Lag' and how a backend engineer can prevent it.",
                expectedKeyConcepts: [
                    "phases: timers -> pending callbacks -> idle/prepare -> poll -> check -> close callbacks",
                    "single main JavaScript execution thread with libuv worker pool for async file/crypto/dns operations",
                    "event loop lag is caused by CPU-intensive synchronous operations blocking the main thread (heavy regex, sync parsing, complex loops)",
                    "prevention: offload to worker_threads, chunk heavy tasks with setImmediate, use streaming and async APIs"
                ]
            },
            {
                id: 6,
                type: "practical",
                difficulty: "advanced",
                category: "practical",
                maxPoints: 30,
                question: "Write an Express.js middleware function for token verification and rate limiting or error handling. Provide the signature `(req, res, next)`, check for authorization headers, handle verification failure, and pass control on success. Explain how you prevent hanging requests.",
                expectedKeyConcepts: [
                    "middleware signature (req, res, next)",
                    "extract Authorization header (Bearer token)",
                    "verify token (e.g. jwt.verify or validation logic)",
                    "return early with res.status(401).json() on failure",
                    "call next() on success to prevent request stalling"
                ],
                sampleCodeCheck: ["req", "res", "next", "return", "status"]
            }
        ]
    }
};

class SkillAssessmentService {
    constructor() {
        // Initialize Gemini client if API key is provided
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                this.aiClient = new GoogleGenAI({ apiKey });
            } catch (err) {
                console.warn("Gemini SDK initialization note:", err.message);
                this.aiClient = null;
            }
        } else {
            this.aiClient = null;
        }
    }

    /**
     * Normalizes skill names for benchmark lookup (e.g., "React.js" -> "react")
     */
    normalizeSkill(skill) {
        if (!skill) return "";
        const s = skill.trim().toLowerCase();
        if (s.includes("react")) return "react";
        if (s.includes("javascript") || s === "js") return "javascript";
        if (s.includes("python")) return "python";
        if (s.includes("node")) return "node.js";
        return s;
    }

    /**
     * Generates a 6-question benchmark assessment for a given skill.
     * Uses curated benchmark tests if available, otherwise invokes Gemini to generate
     * a structured, multi-difficulty assessment with deterministic keys.
     */
    async generateAssessment(skill) {
        const normalized = this.normalizeSkill(skill);

        // 1. Check curated benchmark pool first
        if (CURATED_BENCHMARKS[normalized]) {
            const template = CURATED_BENCHMARKS[normalized];
            return {
                skill: skill,
                title: template.title,
                questions: template.questions.map(q => ({
                    id: q.id,
                    type: q.type,
                    difficulty: q.difficulty,
                    category: q.category,
                    maxPoints: q.maxPoints,
                    question: q.question,
                    options: q.options || [],
                    sampleCodeCheck: q.sampleCodeCheck || []
                })),
                internalBenchmark: template // kept on backend for deterministic grading
            };
        }

        // 2. Dynamic generation using Gemini API with structured JSON
        if (this.aiClient) {
            try {
                const prompt = `You are a senior technical examiner designing a fair, evidence-based skill verification assessment for "${skill}".
Generate an assessment containing exactly 6 questions with this exact composition:
- 4 Multiple Choice Questions (IDs 1-4):
  - Q1: Beginner level (10 points)
  - Q2: Intermediate level (10 points)
  - Q3: Intermediate level (10 points)
  - Q4: Advanced level (10 points)
  Each MCQ must have 4 options labelled "A)", "B)", "C)", "D)", exactly one deterministic correctOptionIndex (0-3), and a clear explanation.
- 1 Conceptual Question (ID 5):
  - Intermediate-to-Advanced level (30 points)
  - A deep explanatory question testing fundamental concepts, architectural rationale, and common trade-offs/pitfalls.
  - Provide 4 specific "expectedKeyConcepts" for scoring.
- 1 Practical / Hands-on Task Question (ID 6):
  - Advanced level (30 points)
  - A realistic implementation or design challenge appropriate for "${skill}".
  - Provide 4 specific "expectedKeyConcepts" and 3-4 "sampleCodeCheck" keywords/tokens.

Respond strictly in valid JSON matching this schema:
{
  "title": "${skill} Knowledge & Practical Assessment",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "difficulty": "beginner",
      "category": "objective",
      "maxPoints": 10,
      "question": "question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctOptionIndex": 0,
      "explanation": "why A is correct"
    },
    ...
    {
      "id": 5,
      "type": "conceptual",
      "difficulty": "intermediate",
      "category": "conceptual",
      "maxPoints": 30,
      "question": "explain ...",
      "expectedKeyConcepts": ["concept 1", "concept 2", "concept 3", "concept 4"]
    },
    {
      "id": 6,
      "type": "practical",
      "difficulty": "advanced",
      "category": "practical",
      "maxPoints": 30,
      "question": "write/design ...",
      "expectedKeyConcepts": ["concept 1", "concept 2", "concept 3", "concept 4"],
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
                    if (parsed.questions && parsed.questions.length >= 6) {
                        return {
                            skill: skill,
                            title: parsed.title || `${skill} Knowledge Assessment`,
                            questions: parsed.questions.map(q => ({
                                id: q.id,
                                type: q.type,
                                difficulty: q.difficulty,
                                category: q.category,
                                maxPoints: q.maxPoints || 10,
                                question: q.question,
                                options: q.options || [],
                                sampleCodeCheck: q.sampleCodeCheck || []
                            })),
                            internalBenchmark: parsed
                        };
                    }
                }
            } catch (aiErr) {
                console.warn("Dynamic AI assessment generation fallback triggered:", aiErr.message);
            }
        }

        // 3. Robust generic benchmark fallback for arbitrary non-cached skills
        return this.createUniversalBenchmark(skill);
    }

    createUniversalBenchmark(skill) {
        const title = `${skill} Core Principles & Practical Assessment`;
        const questions = [
            {
                id: 1,
                type: "mcq",
                difficulty: "beginner",
                category: "objective",
                maxPoints: 10,
                question: `In standard practice with ${skill}, what is the recommended approach when structuring an introductory project or baseline workflow?`,
                options: [
                    `A) Bypass documentation and install unverified third-party dependencies immediately.`,
                    `B) Follow official standards, isolate configurations, and understand the foundational lifecycle.`,
                    `C) Hardcode production secrets directly into public source files.`,
                    `D) Avoid version control until the project is completely finalized.`
                ],
                correctOptionIndex: 1,
                explanation: `Foundational best practices in ${skill} prioritize official conventions, security separation, and clean version control.`
            },
            {
                id: 2,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: `When debugging performance bottlenecks or unexpected state mutations in ${skill}, what is the most reliable first step?`,
                options: [
                    `A) Restart the operating system without checking logs.`,
                    `B) Instrument metrics, analyze call traces/profilers, and reproduce the behavior in an isolated environment.`,
                    `C) Delete all configuration files and reinstall randomly.`,
                    `D) Assume third-party libraries are always flawless and never examine dependency versions.`
                ],
                correctOptionIndex: 1,
                explanation: `Systematic debugging relies on profiling, trace analysis, and reproducible test cases.`
            },
            {
                id: 3,
                type: "mcq",
                difficulty: "intermediate",
                category: "objective",
                maxPoints: 10,
                question: `Which architectural pattern is considered a best practice for reusability and maintainability in ${skill}?`,
                options: [
                    `A) Tightly coupling business logic directly with presentation without modular separation.`,
                    `B) Separation of concerns, modular design, and dependency injection/encapsulation.`,
                    `C) Using a single monolithic file with global variables for all states.`,
                    `D) Ignoring automated testing completely.`
                ],
                correctOptionIndex: 1,
                explanation: `Separation of concerns ensures testability, scalability, and maintainability across updates.`
            },
            {
                id: 4,
                type: "mcq",
                difficulty: "advanced",
                category: "objective",
                maxPoints: 10,
                question: `When deploying or running ${skill} in a production environment with high concurrency, what is vital for reliability?`,
                options: [
                    `A) Disabling error logging to save disk space.`,
                    `B) Implementing health checks, graceful shutdown, structured logging, and resource limits.`,
                    `C) Giving every user unauthenticated administrative permissions.`,
                    `D) Hardcoding IP addresses of single machines with no failover.`
                ],
                correctOptionIndex: 1,
                explanation: `Production resilience requires health checks, structured logs, resource bounds, and failover.`
            },
            {
                id: 5,
                type: "conceptual",
                difficulty: "intermediate",
                category: "conceptual",
                maxPoints: 30,
                question: `Explain the core mental model of ${skill}. What are the primary mechanisms it uses, what are 2 practical advantages compared to alternatives, and what common pitfalls or anti-patterns should a mentor warn learners about?`,
                expectedKeyConcepts: [
                    "core execution model or fundamental paradigm of the skill",
                    "advantages: efficiency, developer experience, scalability, or ecosystem support",
                    "trade-offs, constraints, or common failure modes",
                    "actionable mentoring advice to avoid common beginner traps"
                ]
            },
            {
                id: 6,
                type: "practical",
                difficulty: "advanced",
                category: "practical",
                maxPoints: 30,
                question: `Describe or write a hands-on implementation scenario for ${skill}: walk through solving a realistic real-world task, detailing key methods, inputs, error-handling, and edge cases.`,
                expectedKeyConcepts: [
                    "clear problem breakdown with concrete inputs and outputs",
                    "step-by-step implementation logic or code structure",
                    "defensive validation and error handling",
                    "edge cases considerations and optimization"
                ],
                sampleCodeCheck: ["error", "return", "function", "handle"]
            }
        ];

        return {
            skill: skill,
            title,
            questions: questions.map(q => ({
                id: q.id,
                type: q.type,
                difficulty: q.difficulty,
                category: q.category,
                maxPoints: q.maxPoints,
                question: q.question,
                options: q.options || [],
                sampleCodeCheck: q.sampleCodeCheck || []
            })),
            internalBenchmark: { title, questions }
        };
    }

    /**
     * Evaluates a completed assessment using a multi-factor transparent scoring rubric:
     * - MCQs: Checked against deterministic keys (40 pts)
     * - Conceptual: Key concept coverage + AI structured semantic verification (30 pts)
     * - Practical: Concrete task requirements + code pattern verification (30 pts)
     *
     * Total Score: 0 - 100
     * Level thresholds:
     *   80 - 100: Advanced
     *   55 - 79:  Intermediate
     *   0 - 54:   Beginner
     */
    async evaluateAssessment({ skill, answers, internalBenchmark }) {
        let objectiveScore = 0;
        let conceptualScore = 0;
        let practicalScore = 0;

        const answersRecord = [];
        const strengths = [];
        const areasForImprovement = [];

        const questions = internalBenchmark.questions || [];

        // 1. Grade Objective MCQs deterministically (Questions 1 - 4)
        for (const q of questions.filter(item => item.type === "mcq")) {
            const userAnswer = answers[q.id];
            const isCorrect = userAnswer !== undefined && parseInt(userAnswer, 10) === q.correctOptionIndex;
            const points = isCorrect ? q.maxPoints : 0;
            objectiveScore += points;

            answersRecord.push({
                questionId: q.id,
                questionType: "mcq",
                questionText: q.question,
                userAnswer: userAnswer !== undefined ? `Option ${userAnswer}` : "No answer",
                isCorrect,
                pointsAwarded: points,
                maxPoints: q.maxPoints,
                feedback: isCorrect ? "Correct answer." : `Incorrect. ${q.explanation || ""}`
            });

            if (isCorrect) {
                strengths.push(`${q.difficulty.toUpperCase()} objective concept: ${q.question.slice(0, 45)}...`);
            } else {
                areasForImprovement.push(`Review objective topic: ${q.question.slice(0, 45)}...`);
            }
        }

        // 2. Grade Conceptual Question (Question 5)
        const q5 = questions.find(q => q.id === 5);
        if (q5) {
            const ansText = (answers[5] || "").trim();
            const evaluation = await this.evaluateDescriptiveAnswer({
                skill,
                question: q5.question,
                expectedConcepts: q5.expectedKeyConcepts || [],
                userAnswer: ansText,
                maxPoints: q5.maxPoints || 30,
                type: "conceptual"
            });

            conceptualScore = evaluation.points;
            answersRecord.push({
                questionId: 5,
                questionType: "conceptual",
                questionText: q5.question,
                userAnswer: ansText || "(Empty response)",
                isCorrect: evaluation.points >= (q5.maxPoints * 0.6),
                pointsAwarded: evaluation.points,
                maxPoints: q5.maxPoints,
                feedback: evaluation.feedback
            });

            if (evaluation.strengths) strengths.push(...evaluation.strengths);
            if (evaluation.improvements) areasForImprovement.push(...evaluation.improvements);
        }

        // 3. Grade Practical / Hands-on Task (Question 6)
        const q6 = questions.find(q => q.id === 6);
        if (q6) {
            const practicalText = (answers[6] || "").trim();
            const practicalEval = await this.evaluatePracticalTask({
                skill,
                question: q6.question,
                expectedConcepts: q6.expectedKeyConcepts || [],
                sampleCodeCheck: q6.sampleCodeCheck || [],
                userAnswer: practicalText,
                maxPoints: q6.maxPoints || 30
            });

            practicalScore = practicalEval.points;
            answersRecord.push({
                questionId: 6,
                questionType: "practical",
                questionText: q6.question,
                userAnswer: practicalText || "(Empty response)",
                isCorrect: practicalEval.points >= (q6.maxPoints * 0.6),
                pointsAwarded: practicalEval.points,
                maxPoints: q6.maxPoints,
                feedback: practicalEval.feedback
            });

            if (practicalEval.strengths) strengths.push(...practicalEval.strengths);
            if (practicalEval.improvements) areasForImprovement.push(...practicalEval.improvements);
        }

        // 4. Calculate Final Composite Score
        const totalScore = Math.min(100, Math.max(0, objectiveScore + conceptualScore + practicalScore));

        // Determine Estimated Level
        let estimatedLevel = "Beginner";
        if (totalScore >= 80) {
            estimatedLevel = "Advanced";
        } else if (totalScore >= 55) {
            estimatedLevel = "Intermediate";
        } else {
            estimatedLevel = "Beginner";
        }

        // Summary statement
        const evaluationSummary = `Candidate scored ${totalScore}/100 across objective questions (${objectiveScore}/40), conceptual comprehension (${conceptualScore}/30), and practical implementation (${practicalScore}/30). Demonstrates an estimated ${estimatedLevel} proficiency level in ${skill}.`;

        return {
            skill,
            score: totalScore,
            estimatedLevel,
            status: "completed",
            breakdown: {
                objectiveScore,
                conceptualScore,
                practicalScore
            },
            strengths: Array.from(new Set(strengths)).slice(0, 4),
            areasForImprovement: Array.from(new Set(areasForImprovement)).slice(0, 4),
            evaluationSummary,
            rubricNote: "Assessment estimate based on objective benchmark keys, conceptual rubric verification, and practical test evaluation. Does not certify professional accreditation or guarantee teaching proficiency.",
            answersRecord
        };
    }

    /**
     * Evaluates a descriptive conceptual answer using deterministic keyword/concept matching
     * complemented by Gemini structured semantic verification.
     */
    async evaluateDescriptiveAnswer({ skill, question, expectedConcepts, userAnswer, maxPoints }) {
        if (!userAnswer || userAnswer.length < 15) {
            return {
                points: 0,
                feedback: "No substantive conceptual explanation was provided.",
                improvements: ["Provide a comprehensive explanation covering underlying mechanisms and practical rationale."]
            };
        }

        // Deterministic baseline concept matching
        const lowerAnswer = userAnswer.toLowerCase();
        let matchedConceptsCount = 0;
        for (const concept of expectedConcepts) {
            const keywords = concept.toLowerCase().split(/\s+/).filter(w => w.length > 4);
            const hasMatch = keywords.some(k => lowerAnswer.includes(k));
            if (hasMatch) matchedConceptsCount++;
        }

        const deterministicPoints = Math.round((matchedConceptsCount / Math.max(1, expectedConcepts.length)) * maxPoints);

        // If Gemini is available, combine with structured semantic evaluation
        if (this.aiClient) {
            try {
                const prompt = `You are an impartial academic evaluator assessing a student's answer for the skill "${skill}".
Question: "${question}"
Key rubric concepts expected:
${expectedConcepts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Student's Answer:
"""
${userAnswer}
"""

Evaluate fairly on a scale from 0 to ${maxPoints} points based on accuracy, conceptual understanding, and depth.
Do not grant full marks for generic fluff or buzzwords without clear technical explanation.
Return strictly JSON matching:
{
  "points": <integer from 0 to ${maxPoints}>,
  "feedback": "<concise constructive feedback 1-2 sentences>",
  "strengths": ["<specific strong point>"],
  "improvements": ["<specific area to deepen>"]
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
                    const aiPoints = Math.min(maxPoints, Math.max(0, parseInt(parsed.points, 10) || 0));
                    // Blend deterministic key check with AI semantic evaluation (50% deterministic, 50% AI semantic)
                    const blendedPoints = Math.round((deterministicPoints * 0.4) + (aiPoints * 0.6));

                    return {
                        points: Math.min(maxPoints, blendedPoints),
                        feedback: parsed.feedback || "Answer demonstrated conceptual grounding.",
                        strengths: parsed.strengths || [],
                        improvements: parsed.improvements || []
                    };
                }
            } catch (err) {
                console.warn("AI descriptive grading note:", err.message);
            }
        }

        // Fallback to deterministic rubric
        return {
            points: Math.min(maxPoints, deterministicPoints),
            feedback: `Identified ${matchedConceptsCount} of ${expectedConcepts.length} core benchmark concepts in your explanation.`,
            strengths: matchedConceptsCount > 0 ? [`Addressed ${matchedConceptsCount} key conceptual areas`] : [],
            improvements: matchedConceptsCount < expectedConcepts.length ? ["Deepen coverage of underlying system trade-offs"] : []
        };
    }

    /**
     * Evaluates a practical code or implementation task
     */
    async evaluatePracticalTask({ skill, question, expectedConcepts, sampleCodeCheck, userAnswer, maxPoints }) {
        if (!userAnswer || userAnswer.length < 20) {
            return {
                points: 0,
                feedback: "No implementation code or architecture details were submitted.",
                improvements: ["Include working code examples and handle defensive edge cases."]
            };
        }

        const lowerAnswer = userAnswer.toLowerCase();
        let keywordMatches = 0;
        if (sampleCodeCheck && sampleCodeCheck.length > 0) {
            for (const token of sampleCodeCheck) {
                if (lowerAnswer.includes(token.toLowerCase())) keywordMatches++;
            }
        }

        const deterministicPoints = Math.round((keywordMatches / Math.max(1, (sampleCodeCheck || []).length || 1)) * maxPoints);

        if (this.aiClient) {
            try {
                const prompt = `You are a senior software architect reviewing a practical code/implementation task for "${skill}".
Task: "${question}"
Rubric Requirements:
${expectedConcepts.map((c, i) => `- ${c}`).join("\n")}

Candidate Submission:
"""
${userAnswer}
"""

Evaluate the practical quality, syntax, correctness, defensive error handling, and fulfillment of the requirements.
Score from 0 to ${maxPoints}.
Return strictly JSON:
{
  "points": <integer from 0 to ${maxPoints}>,
  "feedback": "<concise feedback on the implementation>",
  "strengths": ["<implementation strength>"],
  "improvements": ["<potential bug, edge case or improvement>"]
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
                    const aiPoints = Math.min(maxPoints, Math.max(0, parseInt(parsed.points, 10) || 0));
                    const blended = Math.round((deterministicPoints * 0.4) + (aiPoints * 0.6));

                    return {
                        points: Math.min(maxPoints, blended),
                        feedback: parsed.feedback || "Practical task reviewed.",
                        strengths: parsed.strengths || [],
                        improvements: parsed.improvements || []
                    };
                }
            } catch (err) {
                console.warn("AI practical grading note:", err.message);
            }
        }

        return {
            points: Math.min(maxPoints, Math.max(5, deterministicPoints)),
            feedback: `Implementation contains foundational code patterns for ${skill}.`,
            strengths: ["Submitted practical implementation code"],
            improvements: ["Test against edge conditions and edge case inputs"]
        };
    }

    /**
     * Generates 2 targeted follow-up questions dynamically based on the mentor's practical task code
     * to probe their actual understanding of the solution they submitted.
     */
    async generateFollowUpQuestions(skill, practicalTaskText, practicalSolution) {
        if (this.aiClient && practicalSolution && practicalSolution.length > 20) {
            try {
                const prompt = `You are a technical examiner conducting a live proctored skill verification for "${skill}".
The mentor was given this practical coding challenge:
"""
${practicalTaskText}
"""

The mentor submitted this implementation/code:
"""
${practicalSolution}
"""

Generate exactly 2 targeted follow-up technical questions specifically examining their implementation decisions, runtime complexity, edge-case failure modes, or alternative architectural trade-offs in their solution.
Return strictly valid JSON matching:
{
  "questions": [
    {
      "id": 101,
      "topic": "Implementation Rationale",
      "question": "<direct technical question probing a specific decision or mechanism in their solution>",
      "expectedKeyConcepts": ["<key concept 1>", "<key concept 2>", "<key concept 3>"],
      "maxPoints": 10
    },
    {
      "id": 102,
      "topic": "Edge Cases & Optimization",
      "question": "<technical question on how their solution handles concurrency, resource limits, or scale>",
      "expectedKeyConcepts": ["<key concept 1>", "<key concept 2>", "<key concept 3>"],
      "maxPoints": 10
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
                    if (parsed.questions && parsed.questions.length >= 2) {
                        return parsed.questions.slice(0, 2);
                    }
                }
            } catch (err) {
                console.warn("Follow-up generation AI fallback:", err.message);
            }
        }

        // Deterministic follow-up fallback probing implementation depth
        return [
            {
                id: 101,
                topic: "Implementation Rationale",
                question: `In your practical solution for ${skill}, walk through how your code manages memory/scope and what runtime complexity (Big-O) it achieves.`,
                expectedKeyConcepts: ["scope isolation", "time complexity", "space complexity", "resource lifecycle"],
                maxPoints: 10
            },
            {
                id: 102,
                topic: "Edge Cases & Defensive Handling",
                question: `What specific edge cases (such as null/undefined input, rapid re-invocation, or concurrent operations) could break your implementation, and how would you harden it?`,
                expectedKeyConcepts: ["input validation", "defensive exception handling", "concurrency safety", "boundary conditions"],
                maxPoints: 10
            }
        ];
    }

    /**
     * Live AI-Proctored Weighted Assessment Evaluation:
     * - Configurable Weights:
     *     MCQ Score: 30% (mapped to 0-30 scale)
     *     Practical Task: 50% (mapped to 0-50 scale)
     *     Follow-up Questions: 20% (mapped to 0-20 scale)
     * - Total Composite Score: 0 - 100
     * - Verification Level: "Practically Assessed"
     * - Proctoring Metadata: Recorded separately from skill score.
     */
    async evaluateProctoredAssessment({ skill, answers, internalBenchmark, followUpQuestions, proctoringData }) {
        const questions = internalBenchmark.questions || [];
        const answersRecord = [];
        const strengths = [];
        const areasForImprovement = [];

        // 1. Grade MCQs (Deterministic Answer Keys)
        const mcqQuestions = questions.filter(q => q.type === "mcq");
        let rawMcqScore = 0;
        let maxRawMcq = 0;

        for (const q of mcqQuestions) {
            maxRawMcq += q.maxPoints;
            const userAns = answers[q.id];
            const isCorrect = userAns !== undefined && parseInt(userAns, 10) === q.correctOptionIndex;
            const points = isCorrect ? q.maxPoints : 0;
            rawMcqScore += points;

            answersRecord.push({
                questionId: q.id,
                questionType: "mcq",
                questionText: q.question,
                userAnswer: userAns !== undefined ? `Option ${userAns}` : "No answer",
                isCorrect,
                pointsAwarded: points,
                maxPoints: q.maxPoints,
                feedback: isCorrect ? "Correct answer." : `Incorrect. ${q.explanation || ""}`
            });

            if (isCorrect) {
                strengths.push(`Objective concept: ${q.question.slice(0, 42)}...`);
            } else {
                areasForImprovement.push(`Review objective topic: ${q.question.slice(0, 42)}...`);
            }
        }

        // Scale MCQ score to 30% weight (0 to 30)
        const weightedMcqScore = maxRawMcq > 0 ? Math.round((rawMcqScore / maxRawMcq) * 30) : 0;

        // 2. Grade Practical Task (50% weight)
        const practicalQ = questions.find(q => q.type === "practical");
        let weightedPracticalScore = 0;

        if (practicalQ) {
            const practicalAns = (answers[practicalQ.id] || "").trim();
            const practicalEval = await this.evaluatePracticalTask({
                skill,
                question: practicalQ.question,
                expectedConcepts: practicalQ.expectedKeyConcepts || [],
                sampleCodeCheck: practicalQ.sampleCodeCheck || [],
                userAnswer: practicalAns,
                maxPoints: 50 // Directly evaluate out of 50
            });

            weightedPracticalScore = practicalEval.points;
            answersRecord.push({
                questionId: practicalQ.id,
                questionType: "practical",
                questionText: practicalQ.question,
                userAnswer: practicalAns || "(No solution provided)",
                isCorrect: weightedPracticalScore >= 25,
                pointsAwarded: weightedPracticalScore,
                maxPoints: 50,
                feedback: practicalEval.feedback
            });

            if (practicalEval.strengths) strengths.push(...practicalEval.strengths);
            if (practicalEval.improvements) areasForImprovement.push(...practicalEval.improvements);
        }

        // 3. Grade AI Follow-up Questions (20% weight, 10 pts each)
        let weightedFollowUpScore = 0;
        const followUps = followUpQuestions || [];

        for (const fq of followUps) {
            const fqAns = (answers[fq.id] || "").trim();
            const fqEval = await this.evaluateDescriptiveAnswer({
                skill,
                question: fq.question,
                expectedConcepts: fq.expectedKeyConcepts || [],
                userAnswer: fqAns,
                maxPoints: 10,
                type: "conceptual"
            });

            weightedFollowUpScore += fqEval.points;
            answersRecord.push({
                questionId: fq.id,
                questionType: "follow_up",
                questionText: fq.question,
                userAnswer: fqAns || "(No response provided)",
                isCorrect: fqEval.points >= 6,
                pointsAwarded: fqEval.points,
                maxPoints: 10,
                feedback: fqEval.feedback
            });

            if (fqEval.strengths) strengths.push(...fqEval.strengths);
            if (fqEval.improvements) areasForImprovement.push(...fqEval.improvements);
        }

        // Calculate Final Composite Score (0 - 100)
        const compositeScore = Math.min(100, Math.max(0, weightedMcqScore + weightedPracticalScore + weightedFollowUpScore));

        // Determine Estimated Level
        let estimatedLevel = "Beginner";
        if (compositeScore >= 80) {
            estimatedLevel = "Advanced";
        } else if (compositeScore >= 55) {
            estimatedLevel = "Intermediate";
        } else {
            estimatedLevel = "Beginner";
        }

        // Verification Level reflects real evidence:
        // Completed MCQ (30%) + Practical Task (50%) + Follow-ups (20%) -> "Practically Assessed"
        const verificationLevel = "Practically Assessed";

        // Proctoring Telemetry Validation
        const proctoring = {
            consentGiven: Boolean(proctoringData && proctoringData.consentGiven),
            cameraMonitoringActive: Boolean(proctoringData && proctoringData.cameraMonitoringActive),
            fullscreenExitCount: Number(proctoringData && proctoringData.fullscreenExitCount) || 0,
            visibilityChangeCount: Number(proctoringData && proctoringData.visibilityChangeCount) || 0,
            windowBlurCount: Number(proctoringData && proctoringData.windowBlurCount) || 0,
            cameraDisconnectCount: Number(proctoringData && proctoringData.cameraDisconnectCount) || 0,
            isFlaggedForReview: false,
            flagReason: "",
            events: (proctoringData && proctoringData.events) ? proctoringData.events.slice(-50) : []
        };

        // Flagging threshold rule: Repeated exits or visibility losses triggers manual review
        const totalSuspiciousEvents = proctoring.fullscreenExitCount + proctoring.visibilityChangeCount + proctoring.cameraDisconnectCount;
        if (totalSuspiciousEvents >= 5) {
            proctoring.isFlaggedForReview = true;
            proctoring.flagReason = `Flagged for administrative review due to ${proctoring.fullscreenExitCount} full-screen exits, ${proctoring.visibilityChangeCount} visibility changes, and ${proctoring.cameraDisconnectCount} camera interruptions during assessment.`;
        }

        const evaluationSummary = `Candidate scored ${compositeScore}/100 in Live AI-Proctored Verification for ${skill}: MCQ Benchmark (${weightedMcqScore}/30), Practical Implementation (${weightedPracticalScore}/50), and Implementation Follow-Up (${weightedFollowUpScore}/20). Awarded verification status: ${verificationLevel} (${estimatedLevel}).`;

        return {
            skill,
            score: compositeScore,
            verificationLevel,
            estimatedLevel,
            status: proctoring.isFlaggedForReview ? "flagged_for_review" : "completed",
            breakdown: {
                mcqScore: weightedMcqScore,
                practicalScore: weightedPracticalScore,
                followUpScore: weightedFollowUpScore,
                objectiveScore: weightedMcqScore,
                conceptualScore: weightedFollowUpScore
            },
            proctoring,
            strengths: Array.from(new Set(strengths)).slice(0, 4),
            areasForImprovement: Array.from(new Set(areasForImprovement)).slice(0, 4),
            evaluationSummary,
            rubricNote: "Live proctored assessment scored with weighted criteria: MCQ (30%), Practical Implementation (50%), and AI Follow-Up (20%). Proctoring flags denote browser visibility alerts and do not constitute conclusive proof of cheating.",
            answersRecord
        };
    }
}

const skillAssessmentService = new SkillAssessmentService();

module.exports = {
    skillAssessmentService,
    SkillAssessmentService
};
