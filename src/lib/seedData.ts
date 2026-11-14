import type { TestAttempt, TestExam, TestQuestion } from '../types';
import opticsDiagram from '../assets/images/diagram_physics_optics_1794574131101.jpg?inline';
import circuitDiagram from '../assets/images/diagram_circuit_bridge_1794574130210.jpg?inline';

export function buildSampleTests(createdByUid: string): {
  tests: TestExam[];
  questionsByTest: Record<string, TestQuestion[]>;
  sampleAttempts: TestAttempt[];
} {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const sevenDaysLater = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const nextWeek = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();

  const stemTestId = 'apac_stem_optics_circuits_2026';
  const cloudTestId = 'apac_genai_foundations_2026';
  const upcomingTestId = 'apac_algorithms_sprint_2026';

  const tests: TestExam[] = [
    {
      testId: stemTestId,
      title: 'APAC STEM & Engineering Scholarship Mock CBT',
      description:
        'Sectioned diagnostic assessment covering Optics, Wheatstone Bridge Circuits, and Quantitative Aptitude with diagram analysis and step-by-step AI explanations.',
      createdBy: createdByUid,
      startTime: oneHourAgo,
      endTime: sevenDaysLater,
      durationMins: 20,
      totalQuestions: 6,
      passPercentage: 50,
      marksPerQuestion: 4,
      negativeMarking: true,
      negativeMarkValue: 1,
      maxStrikes: 3,
      enforceFullscreen: true,
      detectTabSwitch: true,
      proctoringAIEnabled: false,
      status: 'published',
      sections: [
        { id: 'sec_physics', name: 'Applied Physics', questionCount: 2 },
        { id: 'sec_circuits', name: 'Electrical Circuits', questionCount: 2 },
        { id: 'sec_aptitude', name: 'Quantitative Reasoning', questionCount: 2 },
      ],
    },
    {
      testId: cloudTestId,
      title: 'Cloud & Applied Gen AI Readiness Assessment',
      description:
        'Proctored benchmark test on distributed systems, LLM structured outputs, and production latency optimization. Features optional MediaPipe face proctoring.',
      createdBy: createdByUid,
      startTime: oneHourAgo,
      endTime: sevenDaysLater,
      durationMins: 15,
      totalQuestions: 4,
      passPercentage: 60,
      marksPerQuestion: 4,
      negativeMarking: false,
      negativeMarkValue: 0,
      maxStrikes: 3,
      enforceFullscreen: true,
      detectTabSwitch: true,
      proctoringAIEnabled: true,
      status: 'published',
      sections: [
        { id: 'sec_genai', name: 'Gen AI Engineering', questionCount: 2 },
        { id: 'sec_cloud', name: 'Cloud Architecture', questionCount: 2 },
      ],
    },
    {
      testId: upcomingTestId,
      title: 'APAC Campus Algorithms & Data Structures Qualifier',
      description:
        'Scheduled timed qualifier testing graph traversal, dynamic programming, and complexity bounds.',
      createdBy: createdByUid,
      startTime: tomorrow,
      endTime: nextWeek,
      durationMins: 45,
      totalQuestions: 2,
      passPercentage: 60,
      marksPerQuestion: 4,
      negativeMarking: true,
      negativeMarkValue: 1,
      maxStrikes: 2,
      enforceFullscreen: true,
      detectTabSwitch: true,
      proctoringAIEnabled: false,
      status: 'published',
      sections: [{ id: 'sec_algo', name: 'Algorithms', questionCount: 2 }],
    },
  ];

  const questionsByTest: Record<string, TestQuestion[]> = {
    [stemTestId]: [
      {
        questionId: 'q_stem_1',
        testId: stemTestId,
        testStatus: 'published',
        sectionId: 'sec_physics',
        orderIndex: 0,
        questionText:
          'Refer to the prism refraction diagram below. Light travels from air (n = 1.0) into glass (n = 1.5) at an angle of incidence θ1 = 45°. What is the approximate angle of refraction θ2 inside the glass prism?',
        questionImageUrl: opticsDiagram,
        options: [
          { id: 'A', text: '19.5°' },
          { id: 'B', text: '28.1°' },
          { id: 'C', text: '35.3°' },
          { id: 'D', text: '45.0°' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'Using Snell’s Law n1·sin(θ1) = n2·sin(θ2), sin(θ2) = sin(45°)/1.5 ≈ 0.4714, which gives θ2 ≈ 28.1°.',
        stepByStepSolution: [
          'Write Snell’s Law at the first air-glass boundary P1: n1 · sin(θ1) = n2 · sin(θ2).',
          'Substitute n1 = 1.0, θ1 = 45°, and n2 = 1.5: 1.0 × sin(45°) = 1.5 × sin(θ2).',
          'Compute sin(θ2) = 0.7071 / 1.5 ≈ 0.4714.',
          'Take arcsin(0.4714) ≈ 28.1°, matching the refracted angle labeled in the diagram.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_stem_2',
        testId: stemTestId,
        testStatus: 'published',
        sectionId: 'sec_physics',
        orderIndex: 1,
        questionText:
          'For a triangular prism with apex angle A = 60°, if a monochromatic light ray undergoes minimum deviation δm = 38°, what is the angle of incidence at each face?',
        options: [
          { id: 'A', text: '30°' },
          { id: 'B', text: '45°' },
          { id: 'C', text: '49°' },
          { id: 'D', text: '52°' },
        ],
        correctOptionId: 'C',
        shortExplanation:
          'At minimum deviation, i = (A + δm) / 2 = (60° + 38°) / 2 = 49°.',
        stepByStepSolution: [
          'At minimum deviation, the ray travels symmetrically through the prism so angle of incidence equals angle of emergence (i = e).',
          'Use the prism deviation relation: δm = 2i − A.',
          'Rearrange for i: i = (A + δm) / 2.',
          'Substitute A = 60° and δm = 38°: i = (60° + 38°) / 2 = 49°.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_stem_3',
        testId: stemTestId,
        testStatus: 'published',
        sectionId: 'sec_circuits',
        orderIndex: 2,
        questionText:
          'In the Wheatstone bridge schematic shown below, R1 = 12 Ω, R2 = 24 Ω, and R3 = 15 Ω. What value of R4 ensures zero current flows through the central galvanometer G?',
        questionImageUrl: circuitDiagram,
        options: [
          { id: 'A', text: '20 Ω' },
          { id: 'B', text: '27 Ω' },
          { id: 'C', text: '30 Ω' },
          { id: 'D', text: '36 Ω' },
        ],
        correctOptionId: 'C',
        shortExplanation:
          'A Wheatstone bridge is balanced when R1 / R2 = R3 / R4, giving R4 = (24 × 15) / 12 = 30 Ω.',
        stepByStepSolution: [
          'For zero current through galvanometer G, nodes C and D must be at equal electric potential.',
          'Apply the balanced Wheatstone bridge ratio: R1 / R2 = R3 / R4.',
          'Substitute the given resistances: 12 / 24 = 15 / R4.',
          'Solve for R4: R4 = 15 × (24 / 12) = 15 × 2 = 30 Ω.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_stem_4',
        testId: stemTestId,
        testStatus: 'published',
        sectionId: 'sec_circuits',
        orderIndex: 3,
        questionText:
          'If a 12 V ideal DC source is connected across a balanced Wheatstone bridge where R1 = 10 Ω, R2 = 20 Ω, R3 = 10 Ω, and R4 = 20 Ω, what is the total current drawn from the battery?',
        options: [
          { id: 'A', text: '0.4 A' },
          { id: 'B', text: '0.8 A' },
          { id: 'C', text: '1.2 A' },
          { id: 'D', text: '1.6 A' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'Since the bridge is balanced, the galvanometer branch carries no current. Two parallel branches of 30 Ω each give Req = 15 Ω and I = 12 / 15 = 0.8 A.',
        stepByStepSolution: [
          'Verify balance: R1 / R2 = 10 / 20 = 0.5 and R3 / R4 = 10 / 20 = 0.5, so IG = 0.',
          'Upper branch series resistance: R_upper = R1 + R2 = 10 + 20 = 30 Ω.',
          'Lower branch series resistance: R_lower = R3 + R4 = 10 + 20 = 30 Ω.',
          'Combine parallel branches: Req = (30 × 30) / (30 + 30) = 15 Ω.',
          'Compute total source current using Ohm’s Law: I = V / Req = 12 V / 15 Ω = 0.8 A.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_stem_5',
        testId: stemTestId,
        testStatus: 'published',
        sectionId: 'sec_aptitude',
        orderIndex: 4,
        questionText:
          'A data telemetry pipeline processes 240 exam heartbeats per minute. If server optimizations reduce per-packet processing latency by 25%, how many heartbeats can it handle in 90 seconds?',
        options: [
          { id: 'A', text: '360' },
          { id: 'B', text: '450' },
          { id: 'C', text: '480' },
          { id: 'D', text: '540' },
        ],
        correctOptionId: 'C',
        shortExplanation:
          'A 25% latency reduction increases throughput by 1 / 0.75 = 4/3×, yielding 320/min or 480 in 90 seconds.',
        stepByStepSolution: [
          'Original rate = 240 packets / 60 s = 4 packets/s (0.25 s per packet).',
          'Reducing processing time by 25% gives 0.25 × 0.75 = 0.1875 s per packet.',
          'New rate = 1 / 0.1875 = 5.333... packets/s (or 240 × 4/3 = 320 packets/min).',
          'Over 90 seconds (1.5 minutes): 320 × 1.5 = 480 heartbeats.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_stem_6',
        testId: stemTestId,
        testStatus: 'published',
        sectionId: 'sec_aptitude',
        orderIndex: 5,
        questionText:
          'If a candidate scores +4 marks for each correct answer and −1 mark for each wrong answer across 30 attempted questions, and achieves a net score of 75, how many questions did they answer correctly?',
        options: [
          { id: 'A', text: '19' },
          { id: 'B', text: '21' },
          { id: 'C', text: '22' },
          { id: 'D', text: '24' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'Solving 4c − (30 − c) = 75 gives 5c = 105, so c = 21 correct answers.',
        stepByStepSolution: [
          'Let c be the number of correct answers; then wrong answers w = 30 − c.',
          'Set up the score equation: 4c − 1(30 − c) = 75.',
          'Simplify: 4c − 30 + c = 75 → 5c = 105.',
          'Divide by 5: c = 21 correct answers (with 9 wrong answers: 84 − 9 = 75).',
        ],
        marks: 4,
      },
    ],
    [cloudTestId]: [
      {
        questionId: 'q_cloud_1',
        testId: cloudTestId,
        testStatus: 'published',
        sectionId: 'sec_genai',
        orderIndex: 0,
        questionText:
          'When generating structured MCQ JSON objects with the Gemini API for an assessment builder, which configuration guarantees strict schema adherence?',
        options: [
          { id: 'A', text: 'Setting responseMimeType to "application/json" alongside a typed responseSchema' },
          { id: 'B', text: 'Appending "please return JSON only" to the end of a plain text prompt' },
          { id: 'C', text: 'Increasing maxOutputTokens above 32,000 without a schema' },
          { id: 'D', text: 'Calling the SDK directly inside browser React components' },
        ],
        correctOptionId: 'A',
        shortExplanation:
          'Combining responseMimeType: "application/json" with a formal responseSchema enforces valid structured JSON output.',
        stepByStepSolution: [
          'Prompt instructions alone can still produce markdown code fences or missing keys.',
          'Configuring responseMimeType: "application/json" forces raw JSON output.',
          'Adding responseSchema with Type definitions constrains exact field names and array structures.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_cloud_2',
        testId: cloudTestId,
        testStatus: 'published',
        sectionId: 'sec_genai',
        orderIndex: 1,
        questionText:
          'Why is running MediaPipe FaceDetector on-device via WebAssembly advantageous for live CBT proctoring?',
        options: [
          { id: 'A', text: 'It uploads continuous raw webcam video streams to external servers' },
          { id: 'B', text: 'It preserves student privacy and avoids bandwidth latency by inferring locally in the browser' },
          { id: 'C', text: 'It disables browser Fullscreen API restrictions automatically' },
          { id: 'D', text: 'It requires dedicated server GPU clusters for every student tab' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'On-device WASM inference keeps raw webcam frames private on the student’s machine while delivering sub-50ms face count checks.',
        stepByStepSolution: [
          'Streaming live video from thousands of exam takers saturates bandwidth and raises privacy concerns.',
          'MediaPipe Tasks Vision runs lightweight BlazeFace inference inside the browser via WebAssembly.',
          'Only concise strike events (e.g., "No Face Detected") are logged if a violation persists.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_cloud_3',
        testId: cloudTestId,
        testStatus: 'published',
        sectionId: 'sec_cloud',
        orderIndex: 2,
        questionText:
          'Which Firestore security pattern prevents an attacker from changing their exam score after submitting an attempt?',
        options: [
          { id: 'A', text: 'Hiding the Edit Score button in the React UI' },
          { id: 'B', text: 'Enforcing terminal state locking in firestore.rules so updates fail once status != "in_progress"' },
          { id: 'C', text: 'Using allow read, write: if request.auth != null' },
          { id: 'D', text: 'Storing answers in sessionStorage only' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'Server-enforced terminal state locking in firestore.rules guarantees no client SDK call can alter a submitted attempt.',
        stepByStepSolution: [
          'UI-level hiding can be bypassed with direct REST or SDK calls.',
          'Checking existing().status == "in_progress" inside the Firestore allow update rule blocks post-submission tampering at the database layer.',
        ],
        marks: 4,
      },
      {
        questionId: 'q_cloud_4',
        testId: cloudTestId,
        testStatus: 'published',
        sectionId: 'sec_cloud',
        orderIndex: 3,
        questionText:
          'In an exam Pause & Resume architecture, what should trigger state persistence so a candidate loses minimal progress on an accidental power loss?',
        options: [
          { id: 'A', text: 'Saving only when the Submit Test button is clicked' },
          { id: 'B', text: 'Immediate writes on answer selection/navigation plus a periodic remaining-time heartbeat' },
          { id: 'C', text: 'Manual export to a CSV file by the student every 10 minutes' },
          { id: 'D', text: 'Waiting until the endTime window closes' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'Writing immediately on every response/navigation change combined with a 5–10s timer heartbeat preserves exact resume state.',
        stepByStepSolution: [
          'Event-driven saves on answer selection and mark-for-review prevent losing any chosen option.',
          'A lightweight periodic heartbeat syncs remainingSeconds so the countdown resumes accurately after reconnection.',
        ],
        marks: 4,
      },
    ],
    [upcomingTestId]: [
      {
        questionId: 'q_algo_1',
        testId: upcomingTestId,
        testStatus: 'published',
        sectionId: 'sec_algo',
        orderIndex: 0,
        questionText:
          'What is the worst-case time complexity of Dijkstra’s shortest path algorithm using a binary min-heap on a graph with V vertices and E edges?',
        options: [
          { id: 'A', text: 'O(V²)' },
          { id: 'B', text: 'O((V + E) log V)' },
          { id: 'C', text: 'O(V · E)' },
          { id: 'D', text: 'O(E log E²)' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'Each vertex extraction and edge relaxation takes O(log V) time with a binary heap, yielding O((V + E) log V).',
        stepByStepSolution: [
          'Each of the V vertices is popped from the priority queue at most once: O(V log V).',
          'Each of the E edges can trigger at most one key decrease / push: O(E log V).',
          'Total worst-case complexity is O((V + E) log V).',
        ],
        marks: 4,
      },
      {
        questionId: 'q_algo_2',
        testId: upcomingTestId,
        testStatus: 'published',
        sectionId: 'sec_algo',
        orderIndex: 1,
        questionText:
          'Which traversal order visits nodes level-by-level from the root and guarantees the shortest unweighted path in a graph?',
        options: [
          { id: 'A', text: 'Depth-First Search (DFS)' },
          { id: 'B', text: 'Breadth-First Search (BFS)' },
          { id: 'C', text: 'Post-Order Traversal' },
          { id: 'D', text: 'Topological Sort' },
        ],
        correctOptionId: 'B',
        shortExplanation:
          'BFS explores neighbors in increasing edge distance from the source using a FIFO queue.',
        stepByStepSolution: [
          'BFS uses a queue to process all vertices at distance d before moving to distance d + 1.',
          'Therefore, the first time a vertex is reached, the path length is guaranteed minimal.',
        ],
        marks: 4,
      },
    ],
  };

  const sampleAttempts: TestAttempt[] = [
    {
      attemptId: 'demo_attempt_completed_ananya',
      testId: stemTestId,
      testTitle: 'APAC STEM & Engineering Scholarship Mock CBT',
      userId: 'demo_student_ananya',
      userName: 'Ananya Sharma',
      userEmail: 'ananya.sharma@apac-edu.org',
      status: 'submitted',
      startedAtIso: new Date(now - 35 * 60 * 1000).toISOString(),
      lastActiveAtIso: new Date(now - 21 * 60 * 1000).toISOString(),
      submittedAtIso: new Date(now - 21 * 60 * 1000).toISOString(),
      remainingSeconds: 342,
      currentQuestionIndex: 5,
      currentSectionId: 'sec_aptitude',
      strikeCount: 1,
      strikes: [
        {
          count: 1,
          reason: 'Window Lost Focus (Notification Popup)',
          timestamp: new Date(now - 29 * 60 * 1000).toISOString(),
        },
      ],
      responses: {
        q_stem_1: { selectedOptionId: 'B', markedForReview: false, visited: true },
        q_stem_2: { selectedOptionId: 'C', markedForReview: false, visited: true },
        q_stem_3: { selectedOptionId: 'C', markedForReview: false, visited: true },
        q_stem_4: { selectedOptionId: 'A', markedForReview: true, visited: true },
        q_stem_5: { selectedOptionId: 'C', markedForReview: false, visited: true },
        q_stem_6: { selectedOptionId: 'B', markedForReview: false, visited: true },
      },
      score: 19,
      maxScore: 24,
      accuracy: 83,
      correctCount: 5,
      wrongCount: 1,
      unattemptedCount: 0,
      timeTakenSeconds: 858,
    },
    {
      attemptId: 'demo_attempt_strikeout_wei',
      testId: stemTestId,
      testTitle: 'APAC STEM & Engineering Scholarship Mock CBT',
      userId: 'demo_student_wei',
      userName: 'Wei Lin Tan',
      userEmail: 'weilin.tan@nus-apac.edu',
      status: 'auto_submitted_strike',
      startedAtIso: new Date(now - 50 * 60 * 1000).toISOString(),
      lastActiveAtIso: new Date(now - 44 * 60 * 1000).toISOString(),
      submittedAtIso: new Date(now - 44 * 60 * 1000).toISOString(),
      remainingSeconds: 840,
      currentQuestionIndex: 2,
      currentSectionId: 'sec_circuits',
      strikeCount: 3,
      strikes: [
        {
          count: 1,
          reason: 'Exited Fullscreen Mode',
          timestamp: new Date(now - 48 * 60 * 1000).toISOString(),
        },
        {
          count: 2,
          reason: 'Switched Browser Tab / Minimized',
          timestamp: new Date(now - 46 * 60 * 1000).toISOString(),
        },
        {
          count: 3,
          reason: 'Switched Browser Tab / Minimized',
          timestamp: new Date(now - 44 * 60 * 1000).toISOString(),
        },
      ],
      responses: {
        q_stem_1: { selectedOptionId: 'B', markedForReview: false, visited: true },
        q_stem_2: { selectedOptionId: 'A', markedForReview: false, visited: true },
        q_stem_3: { selectedOptionId: 'C', markedForReview: false, visited: true },
      },
      score: 7,
      maxScore: 24,
      accuracy: 67,
      correctCount: 2,
      wrongCount: 1,
      unattemptedCount: 3,
      timeTakenSeconds: 360,
    },
  ];

  return { tests, questionsByTest, sampleAttempts };
}
