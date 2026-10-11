import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';

type GameMode = 'idle' | 'running' | 'over';

type Pipe = {
  x: number;
  gapY: number;
  passed: boolean;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
};

type ScoreEntry = {
  name: string;
  score: number;
};

const WORLD_WIDTH = 420;
const WORLD_HEIGHT = 700;
const GROUND_Y = 622;
const BIRD_X = 112;
const BIRD_RADIUS = 17;
const PIPE_WIDTH = 72;
const PIPE_GAP = 178;
const PIPE_SPEED = 172;
const STORAGE_KEY = 'sky-sprint-best';
const LEADERBOARD_KEY = 'sky-sprint-leaderboard';
const LEADERBOARD_LIMIT = 5;

function readBestScore() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function readLeaderboard(): ScoreEntry[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(LEADERBOARD_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];

    return value
      .filter(
        (entry): entry is ScoreEntry =>
          typeof entry?.name === 'string' && typeof entry?.score === 'number',
      )
      .map((entry) => ({
        name: entry.name.slice(0, 16),
        score: Math.max(0, Math.floor(entry.score)),
      }))
      .sort((first, second) => second.score - first.score)
      .slice(0, LEADERBOARD_LIMIT);
  } catch {
    return [];
  }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<GameMode>('idle');
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const birdYRef = useRef(WORLD_HEIGHT * 0.43);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const scoreRef = useRef(0);
  const bestRef = useRef(readBestScore());
  const scrollRef = useRef(0);
  const idleTimeRef = useRef(0);
  const canvasSizeRef = useRef({ width: WORLD_WIDTH, height: WORLD_HEIGHT, dpr: 1 });
  const [mode, setMode] = useState<GameMode>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(bestRef.current);
  const [newBest, setNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>(readLeaderboard);
  const [playerName, setPlayerName] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);

  const setGameMode = useCallback((nextMode: GameMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const saveBest = useCallback((value: number) => {
    bestRef.current = value;
    setBest(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Storage can be unavailable in private browsing; the in-memory score still works.
    }
  }, []);

  const addSparks = useCallback((x: number, y: number, count: number, color = '#ffd166') => {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 115;
      sparksRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.38 + Math.random() * 0.34,
        maxLife: 0.72,
        color,
      });
    }
  }, []);

  const resetWorld = useCallback(() => {
    birdYRef.current = WORLD_HEIGHT * 0.43;
    birdVelocityRef.current = 0;
    scoreRef.current = 0;
    pipesRef.current = [
      { x: 520, gapY: 280, passed: false },
      { x: 780, gapY: 408, passed: false },
    ];
    sparksRef.current = [];
    setScore(0);
    setNewBest(false);
    setScoreSaved(false);
  }, []);

  const flap = useCallback(() => {
    if (modeRef.current === 'idle') {
      resetWorld();
      setGameMode('running');
    } else if (modeRef.current === 'over') {
      resetWorld();
      setGameMode('running');
    }

    birdVelocityRef.current = -438;
    addSparks(BIRD_X - 14, birdYRef.current + 8, 5, '#f6a33c');
  }, [addSparks, resetWorld, setGameMode]);

  const endGame = useCallback(() => {
    if (modeRef.current !== 'running') return;
    addSparks(BIRD_X, birdYRef.current, 18, '#ff6b5f');
    setGameMode('over');
    const currentScore = scoreRef.current;
    if (currentScore > bestRef.current) {
      saveBest(currentScore);
      setNewBest(true);
    }
  }, [addSparks, saveBest, setGameMode]);

  const startFresh = useCallback(
    (event?: MouseEvent<HTMLButtonElement>) => {
      event?.stopPropagation();
      resetWorld();
      setGameMode('running');
      birdVelocityRef.current = -438;
      addSparks(BIRD_X - 14, birdYRef.current + 8, 6, '#f6a33c');
      surfaceRef.current?.focus();
    },
    [addSparks, resetWorld, setGameMode],
  );

  const saveScore = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const name = playerName.trim().slice(0, 16) || 'Pilot';
      const nextLeaderboard = [...leaderboard, { name, score }]
        .sort((first, second) => second.score - first.score)
        .slice(0, LEADERBOARD_LIMIT);

      setLeaderboard(nextLeaderboard);
      setPlayerName('');
      setScoreSaved(true);
      try {
        window.localStorage.setItem(
          LEADERBOARD_KEY,
          JSON.stringify(nextLeaderboard),
        );
      } catch {
        // The in-memory leaderboard still works if storage is unavailable.
      }
    },
    [leaderboard, playerName, score],
  );

  const drawScene = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    const { width, height } = canvasSizeRef.current;
    const scaleX = width / WORLD_WIDTH;
    const scaleY = height / WORLD_HEIGHT;
    ctx.save();
    ctx.scale(scaleX, scaleY);

    const time = now / 1000;
    const modeNow = modeRef.current;
    const birdY = birdYRef.current;
    const scroll = scrollRef.current;
    const idleBob = modeNow === 'idle' ? Math.sin(time * 2.5) * 6 : 0;

    const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    sky.addColorStop(0, '#8fd6e5');
    sky.addColorStop(0.52, '#b7e2dc');
    sky.addColorStop(1, '#f6d39b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Sun disk and its quiet halo.
    ctx.fillStyle = 'rgba(255, 244, 190, 0.25)';
    ctx.beginPath();
    ctx.arc(330, 118, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 244, 190, 0.82)';
    ctx.beginPath();
    ctx.arc(330, 118, 35, 0, Math.PI * 2);
    ctx.fill();

    drawCloud(ctx, 68 - ((scroll * 0.16) % 520), 126, 0.8, 0.16);
    drawCloud(ctx, 300 - ((scroll * 0.11) % 600), 208, 0.58, 0.12);
    drawCloud(ctx, 490 - ((scroll * 0.2) % 680), 74, 0.46, 0.1);

    // Distant, soft mountain silhouettes create depth without stealing focus.
    ctx.fillStyle = '#8cbdb1';
    ctx.beginPath();
    ctx.moveTo(0, 486);
    for (let x = 0; x <= WORLD_WIDTH; x += 52) {
      const peak = 430 + Math.sin(x * 0.021 + 0.8) * 28 + Math.sin(x * 0.057) * 13;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(WORLD_WIDTH, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 235, 190, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 535);
    for (let x = 0; x <= WORLD_WIDTH; x += 42) {
      ctx.lineTo(x, 510 + Math.sin(x * 0.025 + 2.4) * 19);
    }
    ctx.lineTo(WORLD_WIDTH, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    pipesRef.current.forEach((pipe) => drawPipe(ctx, pipe));

    // Ground is intentionally chunky, with a moving highlight stripe for rhythm.
    ctx.fillStyle = '#d9894a';
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
    ctx.fillStyle = '#f4bd68';
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, 10);
    ctx.fillStyle = '#c87542';
    for (let x = -((scroll * 0.7) % 38); x < WORLD_WIDTH + 38; x += 38) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 10);
      ctx.lineTo(x + 19, GROUND_Y + 32);
      ctx.lineTo(x + 38, GROUND_Y + 10);
      ctx.lineTo(x + 38, GROUND_Y + 24);
      ctx.lineTo(x + 19, GROUND_Y + 46);
      ctx.lineTo(x, GROUND_Y + 24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(112, 71, 59, 0.18)';
    ctx.fillRect(0, GROUND_Y + 51, WORLD_WIDTH, 2);

    // Bird shadow/feather trail gives every tap a readable response.
    ctx.save();
    ctx.translate(BIRD_X - 18, birdY + idleBob + 22);
    ctx.rotate(-0.15);
    ctx.fillStyle = 'rgba(92, 83, 79, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawBird(ctx, birdY + idleBob, birdVelocityRef.current, time);

    sparksRef.current.forEach((spark) => {
      ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 2.5 + (1 - spark.life / spark.maxLife) * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvasSizeRef.current = { width: canvas.width / dpr, height: canvas.height / dpr, dpr };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const frame = (time: number) => {
      const delta = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 1000, 0.034) : 0;
      lastTimeRef.current = time;
      idleTimeRef.current += delta;

      if (modeRef.current === 'running') {
        scrollRef.current += PIPE_SPEED * delta;
        birdVelocityRef.current += 1450 * delta;
        birdYRef.current += birdVelocityRef.current * delta;

        pipesRef.current.forEach((pipe) => {
          pipe.x -= PIPE_SPEED * delta;
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) {
            pipe.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
            addSparks(BIRD_X + 13, birdYRef.current, 8, '#ffe39b');
          }
        });

        const lastPipe = pipesRef.current[pipesRef.current.length - 1];
        if (lastPipe && lastPipe.x < WORLD_WIDTH - 112) {
          const minimum = 248;
          const maximum = 463;
          pipesRef.current.push({
            x: lastPipe.x + 250,
            gapY: minimum + Math.random() * (maximum - minimum),
            passed: false,
          });
        }
        pipesRef.current = pipesRef.current.filter((pipe) => pipe.x > -PIPE_WIDTH - 20);

        const birdTop = birdYRef.current - BIRD_RADIUS + 3;
        const birdBottom = birdYRef.current + BIRD_RADIUS - 3;
        if (birdTop <= 0 || birdBottom >= GROUND_Y) {
          endGame();
        }
        for (const pipe of pipesRef.current) {
          const withinX = BIRD_X + BIRD_RADIUS - 4 > pipe.x && BIRD_X - BIRD_RADIUS + 4 < pipe.x + PIPE_WIDTH;
          const missesGap = birdTop < pipe.gapY - PIPE_GAP / 2 || birdBottom > pipe.gapY + PIPE_GAP / 2;
          if (withinX && missesGap) {
            endGame();
            break;
          }
        }
      } else if (modeRef.current === 'idle') {
        scrollRef.current = (scrollRef.current + 15 * delta) % 10000;
      }

      sparksRef.current = sparksRef.current
        .map((spark) => ({
          ...spark,
          x: spark.x + spark.vx * delta,
          y: spark.y + spark.vy * delta,
          vy: spark.vy + 280 * delta,
          life: spark.life - delta,
        }))
        .filter((spark) => spark.life > 0);

      drawScene(ctx, time);
      rafRef.current = window.requestAnimationFrame(frame);
    };

    rafRef.current = window.requestAnimationFrame(frame);
    return () => {
      observer.disconnect();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [addSparks, drawScene, endGame]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (event.repeat) return;
      flap();
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flap]);

  useEffect(() => {
    resetWorld();
  }, [resetWorld]);

  return (
    <main className="arcade-app">
      <div className="arcade-orbit orbit-one" />
      <div className="arcade-orbit orbit-two" />
      <header className="game-header">
        <div className="brand-lockup" aria-label="Sky Sprint">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <div>
            <p className="eyebrow">Pocket arcade · 01</p>
            <h1>Sky Sprint</h1>
          </div>
        </div>
        <div className="best-pill" data-testid="text-best-score">
          <span className="best-dot" />
          <span className="best-label">Best</span>
          <strong>{best.toString().padStart(2, '0')}</strong>
        </div>
      </header>

      <section className="game-layout" aria-label="Sky Sprint game">
        <div className={`game-card game-${mode}`}>
          <div className="card-topline">
            <span className="status-kicker">
              {mode === 'running' ? 'In flight' : mode === 'over' ? 'Run complete' : 'Ready when you are'}
            </span>
            <span className="status-signal" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
          <div
            ref={surfaceRef}
            className="game-surface"
            role="application"
            tabIndex={0}
            aria-label="Sky Sprint playfield. Click, tap, or press Space to flap."
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('button, input, form')) return;
              event.preventDefault();
              flap();
              surfaceRef.current?.focus();
            }}
            data-testid="game-surface"
          >
            <canvas ref={canvasRef} aria-hidden="true" />
            <div className="score-display" data-testid="text-score">
              <span>Score</span>
              <strong>{score.toString().padStart(2, '0')}</strong>
            </div>
            <div className="flight-line" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            {mode === 'idle' && (
              <div className="game-overlay intro-overlay">
                <div className="overlay-badge">A tiny test of timing</div>
                <h2>Catch the<br /><em>updraft.</em></h2>
                <p>Keep your wings steady.<br />The gaps will not wait.</p>
                <div className="tap-cue" aria-hidden="true">
                  <span className="tap-ring" />
                  <span className="tap-arrow">↑</span>
                </div>
                <button type="button" className="primary-button" onClick={startFresh} data-testid="button-start-game">
                  Start sprint
                </button>
                <span className="micro-copy">Tap anywhere · Space to flap</span>
              </div>
            )}
            {mode === 'over' && (
              <div className="game-overlay over-overlay">
                <div className="overlay-badge over-badge">{newBest ? 'New personal best' : 'Good run'}</div>
                <h2>Out of<br /><em>the blue.</em></h2>
                <div className="result-row">
                  <div>
                    <span>Run score</span>
                    <strong>{score.toString().padStart(2, '0')}</strong>
                  </div>
                  <div>
                    <span>Best score</span>
                    <strong>{best.toString().padStart(2, '0')}</strong>
                  </div>
                </div>
                <div className="leaderboard-panel">
                  <div className="leaderboard-heading">
                    <span>Local leaderboard</span>
                    <span>Top {LEADERBOARD_LIMIT}</span>
                  </div>
                  {leaderboard.length > 0 ? (
                    <ol className="leaderboard-list">
                      {leaderboard.map((entry, index) => (
                        <li key={`${entry.name}-${entry.score}-${index}`}>
                          <span className="leaderboard-rank">{String(index + 1).padStart(2, '0')}</span>
                          <span className="leaderboard-name">{entry.name}</span>
                          <strong>{entry.score.toString().padStart(2, '0')}</strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="leaderboard-empty">Be the first pilot on the board.</p>
                  )}
                  {!scoreSaved ? (
                    <form className="score-form" onSubmit={saveScore}>
                      <label htmlFor="player-name">Save this run</label>
                      <div className="score-form-row">
                        <input
                          id="player-name"
                          name="playerName"
                          value={playerName}
                          onChange={(event) => setPlayerName(event.target.value)}
                          maxLength={16}
                          placeholder="Your name"
                          autoComplete="nickname"
                        />
                        <button type="submit" className="save-score-button">Save</button>
                      </div>
                    </form>
                  ) : (
                    <p className="score-saved">Score saved on this device.</p>
                  )}
                </div>
                <button type="button" className="primary-button" onClick={startFresh} data-testid="button-restart-game">
                  Fly again
                </button>
                <span className="micro-copy">Tap anywhere · Space to restart</span>
              </div>
            )}
          </div>
          <div className="card-footer">
            <div className="control-key"><span className="keycap">SPACE</span><span>Flap</span></div>
            <div className="flight-meter" aria-label="Flight status">
              <span className={`meter-bar ${mode === 'running' ? 'active' : ''}`} />
              <span className={`meter-bar ${mode === 'running' && score > 2 ? 'active' : ''}`} />
              <span className={`meter-bar ${mode === 'running' && score > 5 ? 'active' : ''}`} />
              <span className={`meter-bar ${mode === 'running' && score > 8 ? 'active' : ''}`} />
            </div>
            <span className="run-label">{mode === 'running' ? 'Keep going' : 'One more run?'}</span>
          </div>
        </div>

        <aside className="side-note">
          <span className="side-index">/ 24</span>
          <div className="side-rule" />
          <p>Small moves.<br /><strong>Long flights.</strong></p>
          <span className="side-caption">A hand-tuned arcade loop for the in-between moments.</span>
        </aside>
      </section>

      <footer className="game-footer">
        <span className="footer-mark">SS<span>•</span>01</span>
        <span className="footer-hint">A quick challenge for clear skies</span>
        <span className="footer-hint footer-right">Best score saves on this device</span>
      </footer>
    </main>
  );
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff5dc';
  ctx.beginPath();
  ctx.ellipse(x, y + 12 * scale, 55 * scale, 15 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 27 * scale, y + 10 * scale, 24 * scale, 14 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 21 * scale, y + 3 * scale, 31 * scale, 22 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 1 * scale, y - 5 * scale, 28 * scale, 26 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe) {
  const topEnd = pipe.gapY - PIPE_GAP / 2;
  const bottomStart = pipe.gapY + PIPE_GAP / 2;
  const pipeGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
  pipeGradient.addColorStop(0, '#31766b');
  pipeGradient.addColorStop(0.28, '#54ad83');
  pipeGradient.addColorStop(0.62, '#7bc58d');
  pipeGradient.addColorStop(1, '#3e8b74');
  ctx.fillStyle = pipeGradient;
  ctx.fillRect(pipe.x + 7, 0, PIPE_WIDTH - 14, topEnd);
  ctx.fillRect(pipe.x + 7, bottomStart, PIPE_WIDTH - 14, GROUND_Y - bottomStart);
  ctx.fillStyle = '#2d665f';
  ctx.fillRect(pipe.x + 7, topEnd - 10, PIPE_WIDTH - 14, 10);
  ctx.fillRect(pipe.x + 7, bottomStart, PIPE_WIDTH - 14, 10);
  ctx.fillStyle = pipeGradient;
  ctx.fillRect(pipe.x, topEnd - 18, PIPE_WIDTH, 18);
  ctx.fillRect(pipe.x, bottomStart, PIPE_WIDTH, 18);
  ctx.fillStyle = 'rgba(219, 255, 191, 0.33)';
  ctx.fillRect(pipe.x + 13, 8, 7, Math.max(0, topEnd - 28));
  ctx.fillRect(pipe.x + 13, bottomStart + 26, 7, Math.max(0, GROUND_Y - bottomStart - 28));
}

function drawBird(ctx: CanvasRenderingContext2D, y: number, velocity: number, time: number) {
  const rotation = Math.max(-0.38, Math.min(1.12, velocity / 600));
  const wingLift = Math.sin(time * 17) * 0.28;
  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate(rotation);

  ctx.fillStyle = 'rgba(78, 61, 61, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 20, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6a33c';
  ctx.beginPath();
  ctx.ellipse(-1, 0, 19, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(-5, -4, 13, 11, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e7783d';
  ctx.beginPath();
  ctx.ellipse(-10, 8 + wingLift * 8, 13, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf1d7';
  ctx.beginPath();
  ctx.arc(7, -7, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#293d4a';
  ctx.beginPath();
  ctx.arc(9, -8, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f9b347';
  ctx.beginPath();
  ctx.moveTo(16, -1);
  ctx.lineTo(30, 3);
  ctx.lineTo(16, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e48135';
  ctx.fillRect(17, 3, 11, 2);
  ctx.restore();
}

export default App;