// tslint:disable
/* eslint-disable */
import {
  ArrowLeft,
  Check,
  Delete,
  HelpCircle,
  Menu,
  Play,
  RotateCw,
  Settings,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  getConfig,
  PLACE_VALUE_NAMES,
  PLACE_VALUE_SHORT,
} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  drawAsset,
  drawBackground,
  gameAudio,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useAutoFocus,
  useIsMobile,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
} from './utils/usePlayground';

const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_math_lab.mp3';

const MASCOT_OWL_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240"><defs><radialGradient id="bodyGrad" cx="50%" cy="40%" r="50%"><stop offset="0%" stop-color="%23fbbf24"/><stop offset="70%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23b45309"/></radialGradient><linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23fef3c7"/><stop offset="100%" stop-color="%23fde68a"/></linearGradient><linearGradient id="coatGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23ffffff"/><stop offset="100%" stop-color="%23e2e8f0"/></linearGradient></defs><ellipse cx="75" cy="225" rx="14" ry="7" fill="%23f59e0b"/><ellipse cx="125" cy="225" rx="14" ry="7" fill="%23f59e0b"/><ellipse cx="100" cy="140" rx="65" ry="80" fill="url(%23bodyGrad)"/><ellipse cx="100" cy="155" rx="42" ry="55" fill="url(%23bellyGrad)"/><path d="M 55 125 Q 70 170 65 210 L 95 210 L 90 145 Z" fill="url(%23coatGrad)" stroke="%23cbd5e1" stroke-width="2"/><path d="M 145 125 Q 130 170 135 210 L 105 210 L 110 145 Z" fill="url(%23coatGrad)" stroke="%23cbd5e1" stroke-width="2"/><polygon points="90,140 100,145 90,150" fill="%23dc2626"/><polygon points="110,140 100,145 110,150" fill="%23dc2626"/><circle cx="100" cy="145" r="4" fill="%23991b1b"/><ellipse cx="42" cy="145" rx="16" ry="38" fill="%23b45309" transform="rotate(15 42 145)"/><ellipse cx="158" cy="145" rx="16" ry="38" fill="%23b45309" transform="rotate(-15 158 145)"/><circle cx="72" cy="95" r="28" fill="%23ffffff" stroke="%2378350f" stroke-width="3"/><circle cx="128" cy="95" r="28" fill="%23ffffff" stroke="%2378350f" stroke-width="3"/><circle cx="75" cy="95" r="14" fill="%231e293b"/><circle cx="125" cy="95" r="14" fill="%231e293b"/><circle cx="71" cy="90" r="5" fill="%23ffffff"/><circle cx="121" cy="90" r="5" fill="%23ffffff"/><circle cx="72" cy="95" r="30" fill="none" stroke="%23f59e0b" stroke-width="4"/><circle cx="128" cy="95" r="30" fill="none" stroke="%23f59e0b" stroke-width="4"/><line x1="102" y1="95" x2="98" y2="95" stroke="%23f59e0b" stroke-width="4"/><line x1="42" y1="95" x2="32" y2="105" stroke="%23f59e0b" stroke-width="3"/><line x1="158" y1="95" x2="168" y2="105" stroke="%23f59e0b" stroke-width="3"/><polygon points="94,106 106,106 100,122" fill="%23ea580c"/><polygon points="100,25 170,48 100,68 30,48" fill="%231e1b4b"/><polygon points="100,25 170,48 100,68 30,48" fill="none" stroke="%23312e81" stroke-width="2"/><path d="M 60 55 L 60 75 Q 100 90 140 75 L 140 55" fill="%231e1b4b"/><circle cx="100" cy="48" r="4" fill="%23fbbf24"/><path d="M 100 48 Q 145 52 148 78" fill="none" stroke="%23fbbf24" stroke-width="3"/><polygon points="144,78 152,78 150,92 146,92" fill="%23fbbf24"/></svg>';

const ASSETS_MANIFEST: Record<string, string> = {
  bg_math_lab: 'assets/images/bg_math_lab.png',
  reward_gold_star: 'assets/images/reward_gold_star.png',
  icon_pencil_cross: 'assets/images/icon_pencil_cross.png',
  mascot_prof_owl: MASCOT_OWL_SVG,
};

// Sub-step for the active column
// BORROW_DONOR: student enters donor's reduced digit (from positive column to the left)
// BORROW_ZERO_CHAIN: student enters 9 for intermediate zero columns
// BORROW_BOOST: student enters current column's boosted digit (effectiveMinuend + 10)
// CALCULATE_DIFF: student enters difference (effectiveMinuend - subtrahend)
type ColumnStep =
  | 'BORROW_DONOR'
  | 'BORROW_ZERO_CHAIN'
  | 'BORROW_BOOST'
  | 'CALCULATE_DIFF';

interface ColumnState {
  originalMinuend: number;
  subtrahend: number;
  effectiveMinuend: number;
  needsBorrow: boolean;
  donorReducedValue?: number;
  boostedValue?: number;
  scratchpadValue?: number | string;
  scratchpadHistory: number[];
  hasStrikethrough: boolean;
  enteredDifference?: number;
  isSolved: boolean;
}

interface ProblemData {
  topNumber: number;
  bottomNumber: number;
  digitCount: number;
  columns: ColumnState[]; // Index 0 is Ones, 1 is Tens, etc.
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  scale: number;
  alpha: number;
  color: string;
}

// Preset problems including the user's specific chained-regrouping problem
const PRESET_PROBLEMS = [
  {
    title: '512,592 − 302,910',
    subtitle: 'Chained Regrouping in Thousands & Hundreds',
    top: 512592,
    bot: 302910,
  },
  {
    title: '700,004 − 258,367',
    subtitle: 'Regrouping Across Zeros (0s become 9s)',
    top: 700004,
    bot: 258367,
  },
  {
    title: '76,912 − 23,318',
    subtitle: '5-Digit Multi-Place Regrouping',
    top: 76912,
    bot: 23318,
  },
  {
    title: '5,243 − 678',
    subtitle: '4-Digit Standard Regrouping Lab',
    top: 5243,
    bot: 678,
  },
];

export function createProblemFromNumbers(topNum: number, botNum: number): ProblemData {
  const topDigits = topNum.toString().split('').reverse();
  const botDigits = botNum.toString().split('').reverse();
  const numCols = topDigits.length;

  const columns: ColumnState[] = [];
  for (let i = 0; i < numCols; i++) {
    const origM = parseInt(topDigits[i], 10);
    const origS = i < botDigits.length ? parseInt(botDigits[i], 10) : 0;
    columns.push({
      originalMinuend: origM,
      subtrahend: origS,
      effectiveMinuend: origM,
      needsBorrow: false,
      scratchpadHistory: [],
      hasStrikethrough: false,
      isSolved: false,
    });
  }

  return {
    topNumber: topNum,
    bottomNumber: botNum,
    digitCount: numCols,
    columns,
  };
}

export default function App() {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  // Playground SDK integration
  const {sdk} = usePlayground();

  // Assets
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;

  // Audio mute states
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);

  // Overlay states
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isCustomProblemOpen, setIsCustomProblemOpen] = useState(false);

  // Custom problem inputs
  const [customTopInput, setCustomTopInput] = useState<string>('512592');
  const [customBotInput, setCustomBotInput] = useState<string>('302910');
  const [customError, setCustomError] = useState<string>('');

  // Configuration options
  const [minuendDigits, setMinuendDigits] = useState<number>(6);
  const [subtrahendDigits, setSubtrahendDigits] = useState<number>(6);

  // Game state
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
  });

  const [mistakes, setMistakes] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [solvedCount, setSolvedCount] = useState<number>(0);

  // Active problem state
  const [currentProblem, setCurrentProblem] = useState<ProblemData | null>(null);
  const [activeCol, setActiveCol] = useState<number>(0);
  const [activeDonorCol, setActiveDonorCol] = useState<number>(-1);
  const [activeZeroCol, setActiveZeroCol] = useState<number>(-1);
  const [activeStep, setActiveStep] = useState<ColumnStep>('CALCULATE_DIFF');
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isCellShaking, setIsCellShaking] = useState<boolean>(false);
  const [speechText, setSpeechText] = useState<string>('');
  const [showProblemSolvedBanner, setShowProblemSolvedBanner] = useState<boolean>(false);

  // Lifecycle reporting
  usePlaygroundGameLifecycle(gameState, sdk);

  // Generate a valid 4th-grade multi-digit subtraction problem
  const generateProblem = useCallback(
    (topLen: number, botLen: number): ProblemData => {
      // If 6 digits is chosen, include the user's exemplary chained-regrouping problem
      if (topLen === 6 && botLen === 6) {
        return createProblemFromNumbers(512592, 302910);
      }

      let topNum = 0;
      let botNum = 0;
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 150) {
        attempts++;
        const topMin = Math.pow(10, topLen - 1);
        const topMax = Math.pow(10, topLen) - 1;
        const botMin = Math.pow(10, botLen - 1);
        const botMax = Math.pow(10, botLen) - 1;

        topNum = Math.floor(Math.random() * (topMax - topMin + 1)) + topMin;
        botNum = Math.floor(Math.random() * (botMax - botMin + 1)) + botMin;

        // Ensure top > bot by at least 150
        if (topNum <= botNum + 150) continue;

        // Check that at least 1 regrouping is needed and subtraction is cleanly possible
        const topDigits = topNum.toString().split('').map((ch) => parseInt(ch, 10)).reverse();
        const botDigits = botNum.toString().split('').map((ch) => parseInt(ch, 10)).reverse();
        const eff = [...topDigits];
        let regroupCount = 0;
        let canBorrow = true;

        for (let i = 0; i < topDigits.length; i++) {
          const s = i < botDigits.length ? botDigits[i] : 0;
          if (eff[i] < s) {
            regroupCount++;
            let d = i + 1;
            while (d < eff.length && eff[d] === 0) {
              d++;
            }
            if (d >= eff.length) {
              canBorrow = false;
              break;
            }
            eff[d] -= 1;
            for (let z = d - 1; z > i; z--) {
              eff[z] = 9;
            }
            eff[i] += 10;
          }
        }

        if (canBorrow && regroupCount >= 1) {
          valid = true;
        }
      }

      if (!valid) {
        if (topLen === 4 && botLen === 3) {
          topNum = 5243;
          botNum = 678;
        } else if (topLen === 5) {
          topNum = 76912;
          botNum = 23318;
        } else {
          topNum = 512592;
          botNum = 302910;
        }
      }

      return createProblemFromNumbers(topNum, botNum);
    },
    [],
  );

  // Setup column step whenever active column or problem changes
  const setupColumnForSolving = useCallback(
    (colIdx: number, problem: ProblemData): ProblemData => {
      // Create a fresh cloned problem structure for state consistency
      const updatedProb: ProblemData = {
        ...problem,
        columns: problem.columns.map((c) => ({
          ...c,
          scratchpadHistory: [...c.scratchpadHistory],
        })),
      };

      const col = updatedProb.columns[colIdx];
      // Evaluate using current effectiveMinuend (which reflects prior donor reductions!)
      const effM = col.effectiveMinuend;
      const s = col.subtrahend;
      const placeName = PLACE_VALUE_NAMES[colIdx] || `Column ${colIdx + 1}`;

      if (effM < s) {
        // Regrouping is required!
        col.needsBorrow = true;
        col.boostedValue = effM + 10;

        // Search for nearest positive donor to the left (skipping zeros if needed)
        let donorIdx = colIdx + 1;
        while (
          donorIdx < updatedProb.columns.length &&
          updatedProb.columns[donorIdx].effectiveMinuend === 0
        ) {
          donorIdx++;
        }

        if (donorIdx < updatedProb.columns.length) {
          const donorCol = updatedProb.columns[donorIdx];
          col.donorReducedValue = donorCol.effectiveMinuend - 1;
          setActiveDonorCol(donorIdx);

          if (donorIdx > colIdx + 1) {
            // Intermediate zeros exist: setup zero chain starting right below donor
            setActiveZeroCol(donorIdx - 1);
            setActiveStep('BORROW_DONOR');
            setSpeechText(
              `We can't subtract ${s} from ${effM} in the ${placeName}, and column to the left is 0! Regroup from ${PLACE_VALUE_NAMES[donorIdx]}: enter ${donorCol.effectiveMinuend} − 1 = ${donorCol.effectiveMinuend - 1} in the box above the ${donorCol.originalMinuend}.`,
            );
          } else {
            setActiveZeroCol(-1);
            setActiveStep('BORROW_DONOR');
            setSpeechText(
              `We can't subtract ${s} from ${effM} in the ${placeName}! Borrow 1 from ${PLACE_VALUE_NAMES[donorIdx]}: enter ${donorCol.effectiveMinuend} − 1 = ${donorCol.effectiveMinuend - 1} in the box above the ${donorCol.originalMinuend}.`,
            );
          }
        }
      } else {
        col.needsBorrow = false;
        setActiveDonorCol(-1);
        setActiveZeroCol(-1);
        setActiveStep('CALCULATE_DIFF');
        if (s === 0) {
          setSpeechText(`Subtract for ${placeName}: ${effM} − 0 = ? (Bring down the ${effM})`);
        } else {
          setSpeechText(`Subtract for ${placeName}: What is ${effM} minus ${s}?`);
        }
      }
      setCurrentInput('');
      return updatedProb;
    },
    [],
  );

  // Spawn star celebration particles
  const spawnCelebration = useCallback((count = 40) => {
    const colors = ['#f59e0b', '#fbbf24', '#fef08a', '#38bdf8', '#34d399', '#f43f5e'];
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      newParticles.push({
        x: canvasWidth / 2,
        y: canvasHeight / 2 - 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        scale: Math.random() * 1.5 + 0.8,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    particlesRef.current.push(...newParticles);
  }, [canvasWidth, canvasHeight]);

  // Start entire game session
  const initGame = useCallback(() => {
    const firstProb = generateProblem(minuendDigits, subtrahendDigits);
    setActiveCol(0);
    setMistakes(0);
    setStreak(0);
    setSolvedCount(0);
    setShowProblemSolvedBanner(false);
    setGameState({
      status: 'PLAYING',
      score: 0,
      level: 1,
    });
    const preparedProb = setupColumnForSolving(0, firstProb);
    setCurrentProblem(preparedProb);
    setIsGameMenuOpen(false);
    setIsHowToPlayOpen(false);
    setIsCustomProblemOpen(false);
    if (sdk) {
      sdk.startGame();
    }
  }, [
    generateProblem,
    minuendDigits,
    subtrahendDigits,
    setupColumnForSolving,
    sdk,
  ]);

  // Load a custom problem or preset
  const loadSpecificProblem = useCallback(
    (topNum: number, botNum: number) => {
      if (topNum <= botNum) {
        setCustomError('Top number (minuend) must be strictly greater than bottom number!');
        return;
      }
      setCustomError('');
      const prob = createProblemFromNumbers(topNum, botNum);
      setMinuendDigits(topNum.toString().length);
      setSubtrahendDigits(botNum.toString().length);
      setActiveCol(0);
      setActiveDonorCol(-1);
      setActiveZeroCol(-1);
      setMistakes(0);
      setStreak(0);
      setSolvedCount(0);
      setShowProblemSolvedBanner(false);
      setGameState({
        status: 'PLAYING',
        score: 0,
        level: 1,
      });
      const preparedProb = setupColumnForSolving(0, prob);
      setCurrentProblem(preparedProb);
      setIsCustomProblemOpen(false);
      setIsGameMenuOpen(false);
      setIsHowToPlayOpen(false);
      gameAudio.playPowerupChime();
      if (sdk) {
        sdk.startGame();
      }
    },
    [setupColumnForSolving, sdk],
  );

  // Restart the current problem cleanly
  const restartCurrentProblem = useCallback(() => {
    if (!currentProblem) return;
    const resetProb = createProblemFromNumbers(
      currentProblem.topNumber,
      currentProblem.bottomNumber,
    );
    setActiveCol(0);
    setActiveDonorCol(-1);
    setActiveZeroCol(-1);
    const preparedProb = setupColumnForSolving(0, resetProb);
    setCurrentProblem(preparedProb);
    setIsGameMenuOpen(false);
  }, [currentProblem, setupColumnForSolving]);

  // Load next problem in the session
  const advanceToNextProblem = useCallback(() => {
    setShowProblemSolvedBanner(false);
    const nextLevel = gameState.level + 1;
    const totalProblems = (getConfig('problemsPerSession') as number) || 5;

    if (nextLevel > totalProblems) {
      // Victory!
      setGameState((prev) => ({
        ...prev,
        status: 'VICTORY',
      }));
      gameAudio.playVictoryFanfare();
      return;
    }

    const nextProb = generateProblem(minuendDigits, subtrahendDigits);
    setActiveCol(0);
    setGameState((prev) => ({
      ...prev,
      level: nextLevel,
      score: prev.score + (getConfig('bonusProblemComplete') as number),
    }));
    const preparedProb = setupColumnForSolving(0, nextProb);
    setCurrentProblem(preparedProb);
    gameAudio.playPowerupChime();
  }, [gameState.level, generateProblem, minuendDigits, subtrahendDigits, setupColumnForSolving]);

  // Handle number input submission
  const submitAnswer = useCallback(() => {
    if (!currentProblem || gameState.status !== 'PLAYING') return;

    const val = parseInt(currentInput, 10);
    if (isNaN(val)) return;

    const prob: ProblemData = {
      ...currentProblem,
      columns: currentProblem.columns.map((c) => ({
        ...c,
        scratchpadHistory: [...c.scratchpadHistory],
      })),
    };
    const col = prob.columns[activeCol];
    const maxMistakesAllowed = (getConfig('maxMistakes') as number) || 5;

    let isCorrect = false;
    let expectedVal = 0;
    let nextStep: ColumnStep = activeStep;
    let nextCol = activeCol;
    let nextDonorCol = activeDonorCol;
    let nextZeroCol = activeZeroCol;

    if (activeStep === 'BORROW_DONOR') {
      const donorCol = prob.columns[activeDonorCol];
      expectedVal = donorCol ? donorCol.effectiveMinuend - 1 : 0;
      if (val === expectedVal) {
        isCorrect = true;
        if (donorCol) {
          donorCol.effectiveMinuend = val;
          donorCol.scratchpadValue = val;
          donorCol.scratchpadHistory.push(val);
          donorCol.hasStrikethrough = true;
        }

        // Check if intermediate zeros exist between donor and active column
        if (activeDonorCol > activeCol + 1) {
          nextStep = 'BORROW_ZERO_CHAIN';
          nextZeroCol = activeDonorCol - 1;
          setSpeechText(
            `Great! ${PLACE_VALUE_NAMES[activeDonorCol]} reduced to ${val}. Now for ${PLACE_VALUE_NAMES[nextZeroCol]}: since 0 borrows 10 and gives 1 to the next column (10 − 1 = 9), enter 9 in its scratchpad box.`,
          );
        } else {
          nextStep = 'BORROW_BOOST';
          nextDonorCol = -1;
          setSpeechText(
            `Excellent! ${PLACE_VALUE_NAMES[activeDonorCol]} reduced to ${val}. Now add 10 to ${PLACE_VALUE_NAMES[activeCol]} (${col.effectiveMinuend} + 10): enter ${col.effectiveMinuend + 10} in its scratchpad box.`,
          );
        }
        gameAudio.playConfirmSelect();
      } else {
        const donorCol = prob.columns[activeDonorCol];
        setSpeechText(
          `Take 1 away from ${donorCol ? donorCol.effectiveMinuend : ''}: ${donorCol ? donorCol.effectiveMinuend : ''} − 1 = ? Try again!`,
        );
      }
    } else if (activeStep === 'BORROW_ZERO_CHAIN') {
      expectedVal = 9;
      if (val === expectedVal) {
        isCorrect = true;
        const zeroCol = prob.columns[activeZeroCol];
        if (zeroCol) {
          zeroCol.effectiveMinuend = 9;
          zeroCol.scratchpadValue = 9;
          zeroCol.scratchpadHistory.push(9);
          zeroCol.hasStrikethrough = true;
        }

        // Check if there are further intermediate zeros to the right
        if (activeZeroCol - 1 > activeCol) {
          nextZeroCol = activeZeroCol - 1;
          nextStep = 'BORROW_ZERO_CHAIN';
          setSpeechText(
            `Spot on! Now for ${PLACE_VALUE_NAMES[nextZeroCol]}: it also borrows 10 and gives 1 to the next column. Enter 9 in its scratchpad box.`,
          );
        } else {
          // All intermediate zeros resolved!
          nextStep = 'BORROW_BOOST';
          nextZeroCol = -1;
          setSpeechText(
            `All zeros regrouped to 9! Now add 10 to ${PLACE_VALUE_NAMES[activeCol]} (${col.effectiveMinuend} + 10): enter ${col.effectiveMinuend + 10} in its scratchpad box.`,
          );
        }
        gameAudio.playConfirmSelect();
      } else {
        setSpeechText(
          `Remember: 0 borrows 10 and gives 1 away (10 − 1 = 9). Enter 9 in the ${PLACE_VALUE_NAMES[activeZeroCol]} scratchpad box!`,
        );
      }
    } else if (activeStep === 'BORROW_BOOST') {
      expectedVal = col.effectiveMinuend + 10;
      if (val === expectedVal) {
        isCorrect = true;
        const boosted = col.effectiveMinuend + 10;
        col.effectiveMinuend = boosted;
        col.scratchpadValue = boosted;
        col.scratchpadHistory.push(boosted);
        col.hasStrikethrough = true;
        nextStep = 'CALCULATE_DIFF';
        nextDonorCol = -1;
        nextZeroCol = -1;
        setSpeechText(
          `Great regrouping! Now subtract in the ${PLACE_VALUE_NAMES[activeCol]}: ${boosted} minus ${col.subtrahend}.`,
        );
        gameAudio.playConfirmSelect();
      } else {
        setSpeechText(
          `Add 10 to ${col.effectiveMinuend}: ${col.effectiveMinuend} + 10 = ? Try again!`,
        );
      }
    } else if (activeStep === 'CALCULATE_DIFF') {
      expectedVal = col.effectiveMinuend - col.subtrahend;
      if (val === expectedVal) {
        isCorrect = true;
        col.enteredDifference = val;
        col.isSolved = true;

        gameAudio.playCoinPickup();
        setStreak((prev) => prev + 1);
        setGameState((prev) => ({
          ...prev,
          score: prev.score + (getConfig('scorePerDigit') as number),
        }));

        // Check if all columns are solved
        if (activeCol + 1 >= prob.digitCount) {
          // Problem complete!
          setSolvedCount((prev) => prev + 1);
          setShowProblemSolvedBanner(true);
          gameAudio.playLevelUpStinger();
          spawnCelebration(50);
          setSpeechText(
            `Hooray! ${(prob.topNumber - prob.bottomNumber).toLocaleString()} is correct!`,
          );
          setCurrentProblem(prob);
          setCurrentInput('');
          return;
        } else {
          // Advance to next column to the left!
          const nextColIdx = activeCol + 1;
          setActiveCol(nextColIdx);
          const preparedProb = setupColumnForSolving(nextColIdx, prob);
          setCurrentProblem(preparedProb);
          return;
        }
      } else {
        setSpeechText(
          `Check your subtraction: ${col.effectiveMinuend} − ${col.subtrahend}. Try again!`,
        );
      }
    }

    if (isCorrect) {
      setCurrentProblem(prob);
      setActiveStep(nextStep);
      setActiveCol(nextCol);
      setActiveDonorCol(nextDonorCol);
      setActiveZeroCol(nextZeroCol);
      setCurrentInput('');
    } else {
      // Mistake!
      gameAudio.playErrorBuzz();
      setIsCellShaking(true);
      setTimeout(() => setIsCellShaking(false), 500);

      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setStreak(0);
      setCurrentInput('');

      if (nextMistakes >= maxMistakesAllowed) {
        setGameState((prev) => ({
          ...prev,
          status: 'GAME_OVER',
        }));
        gameAudio.playDefeatMotif();
      }
    }
  }, [
    currentProblem,
    gameState.status,
    currentInput,
    activeCol,
    activeStep,
    activeDonorCol,
    activeZeroCol,
    mistakes,
    setupColumnForSolving,
    spawnCelebration,
  ]);

  // Keypad button click handler
  const handleKeypadPress = useCallback(
    (key: string) => {
      gameAudio.playCrispClick();
      if (key === 'BACK') {
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (key === 'CLEAR') {
        setCurrentInput('');
      } else if (key === 'ENTER') {
        submitAnswer();
      } else {
        // Limit digit input to 2 digits max (since scratchpad numbers are max 19)
        setCurrentInput((prev) => {
          if (prev.length >= 2) return prev;
          return prev + key;
        });
      }
    },
    [submitAnswer],
  );

  // Keyboard navigation & typing listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCustomProblemOpen) {
          setIsCustomProblemOpen(false);
          return;
        }
        if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
          return;
        }
        if (gameState.status === 'PLAYING') {
          setIsGameMenuOpen((prev) => !prev);
          return;
        }
      }

      if (
        gameState.status !== 'PLAYING' ||
        isGameMenuOpen ||
        isHowToPlayOpen ||
        isCustomProblemOpen
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        gameAudio.playHoverMicroTone();
        setCurrentInput((prev) => (prev.length < 2 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        gameAudio.playCrispClick();
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        submitAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState.status,
    isGameMenuOpen,
    isHowToPlayOpen,
    isCustomProblemOpen,
    submitAnswer,
  ]);

  // Canvas render loop for background and particle celebrations
  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      prepareCanvas(ctx, canvasWidth, canvasHeight);

      // Draw cozy math lab background
      drawBackground(
        ctx,
        assets['bg_math_lab'],
        canvasWidth,
        canvasHeight,
        '#1e293b',
      );

      // Update and draw celebration particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.rotation += p.vRot;
        p.alpha -= 0.015;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.alpha);

        // Draw star shape or particle
        const starImg = assets['reward_gold_star'];
        if (starImg && starImg.complete && starImg.naturalWidth > 0) {
          const sSize = Math.max(0, 28 * p.scale);
          ctx.drawImage(starImg, -sSize / 2, -sSize / 2, sSize, sSize);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0, 8 * p.scale), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [assets, canvasWidth, canvasHeight]);

  // Give a helpful hint when user asks for it
  const handleGiveHint = useCallback(() => {
    if (!currentProblem) return;
    gameAudio.playPowerupChime();
    const col = currentProblem.columns[activeCol];

    if (activeStep === 'BORROW_DONOR') {
      const donorCol = currentProblem.columns[activeDonorCol];
      const reducedVal = donorCol ? donorCol.effectiveMinuend - 1 : 0;
      setSpeechText(
        `Borrowing Step A: Take 1 away from ${PLACE_VALUE_NAMES[activeDonorCol] || 'donor column'} (${donorCol ? donorCol.effectiveMinuend : ''} − 1 = ${reducedVal}). Enter ${reducedVal} in its scratchpad box above ${donorCol ? donorCol.originalMinuend : ''}.`,
      );
    } else if (activeStep === 'BORROW_ZERO_CHAIN') {
      setSpeechText(
        `Borrowing Across Zeros: Since ${PLACE_VALUE_NAMES[activeZeroCol]} has 0, it borrows 10 and gives 1 to the next column (10 − 1 = 9). Enter 9 in its scratchpad box.`,
      );
    } else if (activeStep === 'BORROW_BOOST') {
      const boostedVal = col.effectiveMinuend + 10;
      setSpeechText(
        `Borrowing Step B: Add 10 to our ${PLACE_VALUE_NAMES[activeCol] || 'current column'} (${col.effectiveMinuend} + 10 = ${boostedVal}). Enter ${boostedVal} in its scratchpad box above ${col.originalMinuend}.`,
      );
    } else if (activeStep === 'CALCULATE_DIFF') {
      const diffVal = col.effectiveMinuend - col.subtrahend;
      setSpeechText(
        `Difference Step: Subtract ${col.subtrahend} from ${col.effectiveMinuend} (${col.effectiveMinuend} − ${col.subtrahend} = ${diffVal}). Enter ${diffVal} in the bottom answer row.`,
      );
    }
  }, [currentProblem, activeCol, activeStep, activeDonorCol, activeZeroCol]);

  // Auto-focus buttons
  const startButtonRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START',
  );

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between bg-slate-950 text-white font-sans select-none">
      {/* Background audio loop */}
      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={gameState.status === 'PLAYING' && !isGameMenuOpen}
        isMuted={musicMuted}
      />

      {/* Asset loading fallback */}
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-amber-400 font-sans">
          <div className="text-2xl font-bold animate-pulse">Loading Subtract Lab...</div>
        </div>
      )}

      {/* Top HUD Bar */}
      <header className="w-full h-14 bg-slate-900/90 border-b border-amber-500/30 flex items-center justify-between px-3 md:px-6 z-20 shrink-0 shadow-md">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold border border-amber-500/40">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Score: {gameState.score.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold border border-blue-500/40">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span>Problem: {gameState.level} / {getConfig('problemsPerSession')}</span>
          </div>

          <div className="flex items-center gap-1 bg-red-500/20 text-red-300 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold border border-red-500/40">
            <span>Mistakes:</span>
            <span className="text-white font-black">{mistakes}</span>
            <span className="text-red-400 text-[10px]">/ {getConfig('maxMistakes')}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              gameAudio.playCrispClick();
              setIsCustomProblemOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 rounded-lg border border-indigo-500/40 text-xs md:text-sm font-bold shadow transition-colors active:scale-95"
            title="Custom Problem">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Custom Problem</span>
          </button>

          <button
            onClick={() => {
              gameAudio.playCrispClick();
              setIsGameMenuOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-amber-500/40 text-xs md:text-sm font-bold shadow transition-colors active:scale-95"
            aria-label="Open Menu">
            <Menu className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* Main Play Area */}
      <main className="flex-1 w-full min-h-0 relative flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden">
        {/* Canvas Background Layer */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40"
        />

        {/* Interactive Playfield Overlay */}
        {gameState.status === 'PLAYING' && currentProblem && (
          <div className="relative z-10 w-full max-w-4xl flex flex-col items-center justify-between gap-2 md:gap-3 h-full py-1">
            {/* Professor Hoot Mascot Speech Bubble Bar */}
            <div className="w-full bg-slate-900/90 border-2 border-amber-500/50 rounded-2xl p-2 md:p-3 flex items-center gap-3 md:gap-4 shadow-xl backdrop-blur-md">
              <div className="relative shrink-0">
                <img
                  src={ASSETS_MANIFEST.mascot_prof_owl}
                  alt="Professor Hoot"
                  className="w-12 h-14 md:w-16 md:h-18 object-contain drop-shadow"
                />
                <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black px-1 rounded-full">
                  Prof
                </span>
              </div>
              <div className="flex-1">
                <div className="text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>Professor Hoot</span>
                  {streak >= 2 && (
                    <span className="text-emerald-400 font-extrabold text-[11px] ml-2">
                      Streak: x{streak}!
                    </span>
                  )}
                </div>
                <div className="text-white text-xs md:text-sm font-semibold leading-snug">
                  {speechText ||
                    `Let's solve ${currentProblem.topNumber.toLocaleString()} − ${currentProblem.bottomNumber.toLocaleString()} step by step!`}
                </div>
              </div>
              <button
                onClick={handleGiveHint}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 rounded-xl text-xs font-bold transition-all active:scale-95 shadow">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Hint</span>
              </button>
            </div>

            {/* Blackboard Subtraction Column Pad */}
            <div className="flex-1 w-full max-w-3xl flex flex-col items-center justify-center bg-slate-950/85 border-4 border-amber-600/60 rounded-3xl p-3 md:p-6 shadow-2xl relative overflow-x-auto">
              {/* Place Value Headers */}
              <div className="flex justify-end gap-1.5 sm:gap-2 md:gap-3 w-full pr-2 sm:pr-4 md:pr-8 mb-1 md:mb-2 border-b border-slate-700/60 pb-1">
                {currentProblem.columns
                  .slice()
                  .reverse()
                  .map((_, revIdx) => {
                    const colIdx = currentProblem.columns.length - 1 - revIdx;
                    const isColActive = activeCol === colIdx;
                    const showComma = colIdx === 3;
                    return (
                      <React.Fragment key={`hdr-frag-${colIdx}`}>
                        <div
                          className={`w-10 sm:w-12 md:w-16 text-center text-[10px] sm:text-xs font-bold transition-colors ${
                            isColActive ? 'text-amber-400 scale-105' : 'text-slate-400'
                          }`}>
                          {PLACE_VALUE_SHORT[colIdx] || `10^${colIdx}`}
                        </div>
                        {showComma && (
                          <div className="w-3 sm:w-4 md:w-5 text-center text-[10px] sm:text-xs font-bold text-slate-500 flex items-center justify-center">
                            ,
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Regrouping Scratchpad Row (Dedicated input boxes permanently visible above EVERY place value!) */}
              <div className="flex justify-end gap-1.5 sm:gap-2 md:gap-3 w-full pr-2 sm:pr-4 md:pr-8 mb-1.5 md:mb-2 min-h-[46px] md:min-h-[54px] items-center">
                {currentProblem.columns
                  .slice()
                  .reverse()
                  .map((col, revIdx) => {
                    const colIdx = currentProblem.columns.length - 1 - revIdx;
                    const isDonorActive =
                      activeStep === 'BORROW_DONOR' && activeDonorCol === colIdx;
                    const isZeroActive =
                      activeStep === 'BORROW_ZERO_CHAIN' && activeZeroCol === colIdx;
                    const isBoostActive =
                      activeStep === 'BORROW_BOOST' && activeCol === colIdx;

                    const isInputActive = isDonorActive || isZeroActive || isBoostActive;
                    const isWaitingRecipient =
                      activeStep === 'BORROW_DONOR' && activeCol === colIdx;
                    const hasHistory = col.scratchpadHistory.length > 0;
                    const showComma = colIdx === 3;

                    return (
                      <React.Fragment key={`scratch-frag-${colIdx}`}>
                        <div className="w-10 sm:w-12 md:w-16 flex justify-center items-center relative">
                          {isInputActive ? (
                            /* Active Scratchpad Box (Target of student's current keyboard/numpad input!) */
                            <div
                              className={`min-w-[38px] w-full h-9 sm:h-10 md:h-12 px-1 rounded-xl border-2 flex flex-col items-center justify-center font-black transition-all shadow-md bg-amber-400 text-slate-950 border-white ring-4 ring-amber-400/60 scale-105 ${
                                isCellShaking
                                  ? 'border-red-500 bg-red-400 text-white animate-bounce ring-red-400'
                                  : 'animate-pulse'
                              }`}>
                              <div className="flex items-center justify-center gap-1 overflow-hidden">
                                {col.scratchpadHistory.map((histVal, hIdx) => (
                                  <span
                                    key={hIdx}
                                    className="line-through text-slate-800 text-xs sm:text-sm font-bold opacity-75 decoration-red-600 decoration-2">
                                    {histVal}
                                  </span>
                                ))}
                                <span className="text-slate-950 text-base sm:text-lg md:text-xl font-black">
                                  {currentInput !== '' ? (
                                    currentInput
                                  ) : (
                                    <span className="text-slate-900 text-xs sm:text-sm font-black animate-pulse">?</span>
                                  )}
                                </span>
                              </div>
                              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tight text-slate-900 leading-none">
                                {isDonorActive ? 'Donor −1' : isZeroActive ? 'Borrow 9' : '+10 Boost'}
                              </span>
                            </div>
                          ) : isWaitingRecipient ? (
                            /* Expectant Recipient Box (Visibly shows "+10 next" while donor is being reduced!) */
                            <div className="min-w-[38px] w-full h-9 sm:h-10 md:h-12 px-1 rounded-xl border-2 border-dashed border-amber-400/80 bg-amber-500/15 flex flex-col items-center justify-center font-bold text-amber-300 shadow-sm animate-pulse">
                              <span className="text-xs sm:text-sm font-black text-amber-300">+10</span>
                              <span className="text-[8px] sm:text-[9px] font-bold text-amber-400/90 leading-none uppercase">
                                Recipient
                              </span>
                            </div>
                          ) : hasHistory || col.scratchpadValue !== undefined ? (
                            /* Recorded Scratchpad Box (Shows history with previous values struck through!) */
                            <div className="min-w-[38px] w-full h-9 sm:h-10 md:h-12 px-1 rounded-xl border-2 border-amber-500/70 bg-slate-800 text-amber-300 flex items-center justify-center font-black shadow">
                              <div className="flex items-center justify-center gap-1 overflow-hidden px-1">
                                {col.scratchpadHistory.slice(0, -1).map((histVal, hIdx) => (
                                  <span
                                    key={hIdx}
                                    className="line-through text-slate-400 text-xs sm:text-sm font-semibold opacity-70 decoration-red-400 decoration-2">
                                    {histVal}
                                  </span>
                                ))}
                                <span className="text-amber-300 text-sm sm:text-base md:text-lg font-black">
                                  {col.scratchpadHistory.length > 0
                                    ? col.scratchpadHistory[col.scratchpadHistory.length - 1]
                                    : col.scratchpadValue}
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* Unused / Idle Scratchpad Box (Always present & visible to invite regrouping!) */
                            <div
                              title={`Scratchpad box for ${PLACE_VALUE_NAMES[colIdx]}`}
                              className="min-w-[38px] w-full h-9 sm:h-10 md:h-12 px-1 rounded-xl border-2 border-dashed border-slate-700/60 bg-slate-900/40 flex items-center justify-center text-slate-600/70 hover:border-slate-600 transition-colors">
                              <span className="text-[10px] sm:text-xs font-semibold text-slate-600 select-none">
                                —
                              </span>
                            </div>
                          )}
                        </div>
                        {showComma && <div className="w-3 sm:w-4 md:w-5" />}
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Minuend Row (Top Number with strikethroughs on modified digits) */}
              <div className="flex justify-end gap-1.5 sm:gap-2 md:gap-3 w-full pr-2 sm:pr-4 md:pr-8 relative">
                {currentProblem.columns
                  .slice()
                  .reverse()
                  .map((col, revIdx) => {
                    const colIdx = currentProblem.columns.length - 1 - revIdx;
                    const isCrossedOut = col.hasStrikethrough;
                    const showComma = colIdx === 3;

                    return (
                      <React.Fragment key={`minuend-frag-${colIdx}`}>
                        <div className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-14 flex items-center justify-center relative font-black text-2xl sm:text-3xl md:text-4xl text-slate-100">
                          <span className={isCrossedOut ? 'text-slate-500 select-none' : 'select-none'}>
                            {col.originalMinuend}
                          </span>
                          {/* Red strike-through line for borrowed digits */}
                          {isCrossedOut && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-8 md:w-12 h-1 bg-red-500 -rotate-45 transform rounded-full shadow-lg" />
                            </div>
                          )}
                        </div>
                        {showComma && (
                          <div className="w-3 sm:w-4 md:w-5 h-10 sm:h-12 md:h-14 flex items-center justify-center font-black text-2xl sm:text-3xl md:text-4xl text-slate-100 select-none">
                            ,
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Subtrahend Row (Bottom Number, cleanly formatted with no awkward leading zeros) */}
              <div className="flex justify-end gap-1.5 sm:gap-2 md:gap-3 w-full pr-2 sm:pr-4 md:pr-8 relative mt-1 md:mt-2">
                <span className="absolute left-2 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 text-2xl sm:text-3xl md:text-4xl font-black text-amber-400 select-none">
                  −
                </span>
                {currentProblem.columns
                  .slice()
                  .reverse()
                  .map((col, revIdx) => {
                    const colIdx = currentProblem.columns.length - 1 - revIdx;
                    const botDigitCount = currentProblem.bottomNumber.toString().length;
                    const isLeadingPadding = colIdx >= botDigitCount;
                    const showComma = colIdx === 3;
                    const showCommaSub = showComma && botDigitCount >= 4;

                    return (
                      <React.Fragment key={`sub-frag-${colIdx}`}>
                        <div className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-14 flex items-center justify-center font-black text-2xl sm:text-3xl md:text-4xl text-amber-200 select-none">
                          {isLeadingPadding ? '' : col.subtrahend}
                        </div>
                        {showComma && (
                          <div className="w-3 sm:w-4 md:w-5 h-10 sm:h-12 md:h-14 flex items-center justify-center font-black text-2xl sm:text-3xl md:text-4xl text-amber-200 select-none">
                            {showCommaSub ? ',' : ''}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Horizontal Calculation Bar */}
              <div className="w-full h-1.5 bg-amber-400 rounded-full my-2 md:my-3 shadow" />

              {/* Difference Row (Answer Cells with thousands comma separator) */}
              <div className="flex justify-end gap-1.5 sm:gap-2 md:gap-3 w-full pr-2 sm:pr-4 md:pr-8">
                {currentProblem.columns
                  .slice()
                  .reverse()
                  .map((col, revIdx) => {
                    const colIdx = currentProblem.columns.length - 1 - revIdx;
                    const isDiffActive =
                      activeStep === 'CALCULATE_DIFF' && activeCol === colIdx;
                    const showComma = colIdx === 3;

                    const cellVal = isDiffActive
                      ? currentInput
                      : col.enteredDifference ?? '';

                    return (
                      <React.Fragment key={`diff-frag-${colIdx}`}>
                        <div
                          className={`w-10 sm:w-12 md:w-16 h-11 sm:h-14 md:h-16 rounded-xl border-3 flex items-center justify-center font-black text-2xl sm:text-3xl md:text-4xl transition-all shadow-inner ${
                            isDiffActive
                              ? `bg-amber-400 text-slate-950 border-white ring-4 ring-amber-400/50 scale-105 ${
                                  isCellShaking ? 'bg-red-500 text-white ring-red-400 animate-bounce' : 'animate-pulse'
                                }`
                              : col.isSolved
                              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}>
                          {cellVal}
                        </div>
                        {showComma && (
                          <div className="w-3 sm:w-4 md:w-5 h-11 sm:h-14 md:h-16 flex items-center justify-center font-black text-2xl sm:text-3xl md:text-4xl text-amber-300 select-none">
                            ,
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Problem Solved Celebratory Banner */}
              {showProblemSolvedBanner && (
                <div className="absolute inset-0 z-30 bg-slate-950/95 rounded-3xl flex flex-col items-center justify-center p-6 border-4 border-amber-400 animate-fadeIn backdrop-blur-sm">
                  <div className="w-16 h-16 md:w-20 md:h-20 mb-2">
                    <img
                      src={ASSETS_MANIFEST.reward_gold_star}
                      alt="Gold Star"
                      className="w-full h-full object-contain animate-bounce drop-shadow-lg"
                    />
                  </div>
                  <h2 className="text-2xl md:text-4xl font-black text-amber-400 mb-1 text-center">
                    Problem Complete!
                  </h2>
                  <p className="text-slate-200 text-base md:text-xl font-bold mb-4 text-center">
                    {currentProblem.topNumber.toLocaleString()} −{' '}
                    {currentProblem.bottomNumber.toLocaleString()} ={' '}
                    <span className="text-amber-300 font-black">
                      {(currentProblem.topNumber - currentProblem.bottomNumber).toLocaleString()}
                    </span>
                  </p>
                  <button
                    onClick={advanceToNextProblem}
                    autoFocus
                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base md:text-lg rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-2">
                    <span>Next Problem</span>
                    <Sparkles className="w-5 h-5 text-slate-950" />
                  </button>
                </div>
              )}
            </div>

            {/* Virtual Responsive Numpad & Action Controls */}
            <div className="w-full max-w-xl bg-slate-900/95 border-2 border-slate-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-md">
              <div className="grid grid-cols-6 sm:grid-cols-6 gap-1.5 sm:gap-2">
                {['1', '2', '3', '4', '5', '6'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeypadPress(num)}
                    className="min-w-[48px] min-h-[48px] h-12 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-black text-lg md:text-xl rounded-xl border border-slate-600 transition-colors shadow flex items-center justify-center select-none touch-none">
                    {num}
                  </button>
                ))}
                {['7', '8', '9', '0'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeypadPress(num)}
                    className="min-w-[48px] min-h-[48px] h-12 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-black text-lg md:text-xl rounded-xl border border-slate-600 transition-colors shadow flex items-center justify-center select-none touch-none">
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => handleKeypadPress('BACK')}
                  className="min-w-[48px] min-h-[48px] h-12 bg-rose-950/70 hover:bg-rose-900 text-rose-300 font-bold text-sm md:text-base rounded-xl border border-rose-700/50 transition-colors shadow flex items-center justify-center gap-1 active:scale-95 touch-none"
                  aria-label="Backspace">
                  <Delete className="w-5 h-5" />
                </button>
                <button
                  onClick={submitAnswer}
                  className="min-w-[48px] min-h-[48px] h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-300 text-slate-950 font-black text-sm md:text-base rounded-xl border border-amber-300 transition-colors shadow-lg flex items-center justify-center gap-1 active:scale-95 touch-none">
                  <Check className="w-5 h-5 text-slate-950" />
                  <span>Enter</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Main Start / Setup Screen */}
      {gameState.status === 'START' && (
        <MenuOverlay>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center">
            {/* Mascot Icon */}
            <div className="w-24 h-24 mb-2 relative">
              <img
                src={ASSETS_MANIFEST.mascot_prof_owl}
                alt="Professor Hoot"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-amber-400 text-center mb-1">
              Subtract Lab
            </h1>
            <p className="text-slate-300 text-xs md:text-sm text-center mb-4">
              Master column subtraction place values & step-by-step regrouping!
            </p>

            {/* Quick Practice Presets */}
            <div className="w-full bg-slate-950/80 border border-amber-500/40 rounded-2xl p-3 mb-4">
              <span className="text-[11px] font-black uppercase text-amber-400 block mb-2 tracking-wider">
                Featured Practice Presets:
              </span>
              <div className="flex flex-col gap-1.5">
                {PRESET_PROBLEMS.map((preset) => (
                  <button
                    key={preset.title}
                    onClick={() => {
                      gameAudio.playCrispClick();
                      loadSpecificProblem(preset.top, preset.bot);
                    }}
                    className="w-full text-left p-2 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 transition-all flex items-center justify-between group">
                    <div>
                      <div className="text-xs sm:text-sm font-black text-white group-hover:text-amber-300">
                        {preset.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {preset.subtitle}
                      </div>
                    </div>
                    <Play className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  </button>
                ))}
              </div>
            </div>

            {/* Digit Length Configuration */}
            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-4 mb-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-1.5">
                  Top Number (Minuend Digits):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[4, 5, 6].map((digits) => (
                    <button
                      key={digits}
                      onClick={() => {
                        gameAudio.playCrispClick();
                        setMinuendDigits(digits);
                        if (subtrahendDigits > digits) {
                          setSubtrahendDigits(digits);
                        }
                      }}
                      className={`min-h-[44px] py-1.5 rounded-xl font-black text-sm md:text-base border transition-all ${
                        minuendDigits === digits
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}>
                      {digits} Digits
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-1.5">
                  Bottom Number (Subtrahend Digits):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 4, 5, 6].map((digits) => {
                    const isDisabled = digits > minuendDigits;
                    return (
                      <button
                        key={digits}
                        disabled={isDisabled}
                        onClick={() => {
                          gameAudio.playCrispClick();
                          setSubtrahendDigits(digits);
                        }}
                        className={`min-h-[44px] py-1.5 rounded-xl font-black text-xs md:text-sm border transition-all ${
                          isDisabled
                            ? 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed opacity-40'
                            : subtrahendDigits === digits
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}>
                        {digits}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2">
              <button
                ref={startButtonRef}
                onClick={initGame}
                autoFocus
                className="w-full min-h-[50px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-lg py-2.5 rounded-2xl shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2">
                <Play className="w-5 h-5 fill-slate-950" />
                <span>START PRACTICE</span>
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsCustomProblemOpen(true);
                }}
                className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-sm py-2 rounded-xl border border-amber-500/30 transition-colors flex items-center justify-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Enter Custom Problem...</span>
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* Custom Problem Modal */}
      {isCustomProblemOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 text-white">
            <h2 className="text-2xl font-black text-amber-400 text-center">
              Custom Subtraction Problem
            </h2>
            <p className="text-xs text-slate-300 text-center">
              Type any two numbers to practice step-by-step column regrouping!
            </p>

            <div className="w-full flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-amber-300 uppercase block mb-1">
                  Top Number (Minuend):
                </label>
                <input
                  type="number"
                  value={customTopInput}
                  onChange={(e) => setCustomTopInput(e.target.value)}
                  placeholder="e.g. 512592"
                  className="w-full h-11 px-3 bg-slate-950 border-2 border-slate-700 focus:border-amber-400 rounded-xl text-lg font-black text-amber-300 outline-none text-right"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-amber-300 uppercase block mb-1">
                  Bottom Number (Subtrahend):
                </label>
                <input
                  type="number"
                  value={customBotInput}
                  onChange={(e) => setCustomBotInput(e.target.value)}
                  placeholder="e.g. 302910"
                  className="w-full h-11 px-3 bg-slate-950 border-2 border-slate-700 focus:border-amber-400 rounded-xl text-lg font-black text-amber-200 outline-none text-right"
                />
              </div>

              {customError && (
                <div className="text-xs font-bold text-rose-400 bg-rose-950/60 p-2 rounded-lg border border-rose-800">
                  {customError}
                </div>
              )}
            </div>

            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  const top = parseInt(customTopInput, 10);
                  const bot = parseInt(customBotInput, 10);
                  if (isNaN(top) || isNaN(bot)) {
                    setCustomError('Please enter valid numbers in both boxes!');
                    return;
                  }
                  loadSpecificProblem(top, bot);
                }}
                className="w-full min-h-[48px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <Play className="w-5 h-5 fill-slate-950" />
                <span>Solve This Problem</span>
              </button>

              <button
                onClick={() => setIsCustomProblemOpen(false)}
                className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* Game Menu Overlay */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4">
            <h2 className="text-2xl md:text-3xl font-black text-amber-400">
              Lab Menu
            </h2>

            <div className="w-full flex flex-col gap-2.5">
              {/* Resume */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                }}
                className="w-full min-h-[48px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <Play className="w-5 h-5 fill-slate-950" />
                <span>Resume</span>
              </button>

              {/* Music Toggle */}
              <button
                onClick={() => {
                  setMusicMuted((prev) => !prev);
                  gameAudio.playCrispClick();
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-base rounded-xl border border-slate-700 transition-colors flex items-center justify-between px-4">
                <span className="flex items-center gap-2">
                  {musicMuted ? (
                    <VolumeX className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-amber-400" />
                  )}
                  <span>Music</span>
                </span>
                <span className={`font-bold ${musicMuted ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {musicMuted ? 'Muted' : 'On'}
                </span>
              </button>

              {/* SFX Toggle */}
              <button
                onClick={() => {
                  const muted = gameAudio.toggleMute();
                  setSfxMuted(muted);
                  gameAudio.playCrispClick();
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-base rounded-xl border border-slate-700 transition-colors flex items-center justify-between px-4">
                <span className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Sound Effects</span>
                </span>
                <span className={`font-bold ${sfxMuted ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sfxMuted ? 'Muted' : 'On'}
                </span>
              </button>

              {/* Try Problem Again */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  restartCurrentProblem();
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-base rounded-xl border border-amber-500/30 transition-colors flex items-center justify-center gap-2">
                <RotateCw className="w-5 h-5" />
                <span>Restart Current Problem</span>
              </button>

              {/* Custom Problem */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsCustomProblemOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-base rounded-xl border border-indigo-500/30 transition-colors flex items-center justify-center gap-2">
                <Settings className="w-5 h-5" />
                <span>Custom Problem...</span>
              </button>

              {/* How to Play */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsHowToPlayOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold text-base rounded-xl border border-blue-500/30 transition-colors flex items-center justify-center gap-2">
                <HelpCircle className="w-5 h-5" />
                <span>How to Regroup</span>
              </button>

              {/* Quit to Main Setup */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full min-h-[48px] bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-bold text-base rounded-xl border border-rose-800/60 transition-colors flex items-center justify-center gap-2">
                <ArrowLeft className="w-5 h-5" />
                <span>Quit to Setup</span>
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* How to Play Overlay */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-blue-400/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 text-slate-200">
            <h2 className="text-2xl md:text-3xl font-black text-amber-400 text-center">
              How to Regroup
            </h2>

            <div className="w-full bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs md:text-sm flex flex-col gap-3 leading-relaxed">
              <p>
                <strong className="text-amber-300">1. Column Order:</strong> Solve
                from right to left (Ones, Tens, Hundreds, Thousands, etc.).
              </p>
              <p>
                <strong className="text-amber-300">2. Regrouping (Borrowing):</strong> If the current top digit is smaller than the bottom digit, regrouping is triggered:
              </p>
              <ul className="list-disc list-inside pl-2 text-slate-300 space-y-1.5">
                <li>
                  <span className="text-amber-400 font-bold">Step A (Donor):</span> Take 1 from the nearest positive column to the left. Type its new reduced value in its scratchpad box above that digit!
                </li>
                <li>
                  <span className="text-amber-400 font-bold">Step B (Borrowing Across Zeros):</span> Any intermediate 0 columns between the donor and active column become 9! Type 9 in each zero column's scratchpad box.
                </li>
                <li>
                  <span className="text-amber-400 font-bold">Step C (Recipient):</span> Add 10 to your current digit (e.g. 5 becomes 15, or 1 becomes 11). Type its boosted value in its scratchpad box!
                </li>
                <li>
                  <span className="text-amber-400 font-bold">Chained Regrouping:</span> If a column was already borrowed from (e.g. 2 reduced to 1) and is smaller than its bottom digit (e.g. 1 &lt; 2), you regroup AGAIN! Previous scratchpad values remain visible and struck through cleanly.
                </li>
                <li>
                  <span className="text-emerald-400 font-bold">Step D (Subtract):</span> Subtract your current top digit minus bottom digit and enter the difference in the answer row!
                </li>
              </ul>
              <p>
                <strong className="text-amber-300">3. Mistake Limit:</strong> You have 5 mistake hearts. Professor Hoot is always ready with step-by-step hints!
              </p>
            </div>

            <button
              onClick={() => {
                gameAudio.playCrispClick();
                setIsHowToPlayOpen(false);
              }}
              autoFocus
              className="w-full min-h-[48px] bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-base rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              <X className="w-5 h-5 text-slate-950" />
              <span>Back to Menu</span>
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Game Over Screen */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="PRACTICE FINISHED"
          description={`Mistake tolerance reached (5/5). Final Score: ${gameState.score.toLocaleString()}`}
          actionLabel="TRY AGAIN"
          onAction={initGame}
          icon={<RotateCw className="w-6 h-6" />}
          tone="danger"
        />
      )}

      {/* Victory / Session Complete Screen */}
      {gameState.status === 'VICTORY' && (
        <MenuOverlay tone="victory">
          <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-20 h-20 mb-3">
              <img
                src={ASSETS_MANIFEST.reward_gold_star}
                alt="Victory Star"
                className="w-full h-full object-contain animate-bounce"
              />
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-amber-400 mb-1">
              Lab Mastery!
            </h1>
            <p className="text-emerald-300 text-sm md:text-base font-bold mb-4">
              All Subtraction Problems Solved!
            </p>

            {/* Star Rating Badge */}
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3].map((starNum) => {
                const isEarned =
                  starNum === 1 ||
                  (starNum === 2 && mistakes <= 2) ||
                  (starNum === 3 && mistakes === 0);
                return (
                  <Star
                    key={starNum}
                    className={`w-8 h-8 md:w-10 md:h-10 transition-transform ${
                      isEarned
                        ? 'text-yellow-400 fill-yellow-400 scale-110 drop-shadow'
                        : 'text-slate-600 fill-slate-800'
                    }`}
                  />
                );
              })}
            </div>

            {/* Report Card */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 text-xs md:text-sm flex flex-col gap-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>Final Score:</span>
                <span className="font-black text-amber-400 text-base">{gameState.score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Accuracy Mistakes:</span>
                <span className="font-bold text-white">{mistakes} / 5</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Place Values Solved:</span>
                <span className="font-bold text-emerald-400">{minuendDigits} Digits</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={initGame}
                autoFocus
                className="w-full min-h-[50px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-lg py-2.5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <RotateCw className="w-5 h-5 text-slate-950" />
                <span>Play Again</span>
              </button>

              <button
                onClick={() => setGameState((prev) => ({...prev, status: 'START'}))}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-base py-2 rounded-2xl border border-slate-700 transition-colors">
                Change Digit Lengths
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
