import { useEffect, useRef } from 'react';
import styles from './ParticleBackground.module.css';

interface Wave {
  baseY: number;
  amplitude: number;
  frequency: number;
  phaseOffset: number;
  phaseSpeed: number;
  alpha: number;
  lineWidth: number;
}

const WAVE_COUNT = 10;
const SEGMENTS = 150;
const MESH_SPACING = 50;

function getWaveY(wave: Wave, x: number, time: number, h: number) {
  return (
    wave.baseY * h +
    Math.sin(x * wave.frequency + time * wave.phaseSpeed + wave.phaseOffset) *
      wave.amplitude +
    Math.sin(
      x * wave.frequency * 0.6 + time * wave.phaseSpeed * 0.8 + wave.phaseOffset * 1.3,
    ) *
      wave.amplitude *
      0.4
  );
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wavesRef = useRef<Wave[]>([]);
  const raf = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const waves: Wave[] = [];
    for (let i = 0; i < WAVE_COUNT; i++) {
      const t = i / (WAVE_COUNT - 1);
      waves.push({
        baseY: 0.38 + t * 0.52,
        amplitude: 15 + Math.random() * 30,
        frequency: 0.0015 + Math.random() * 0.003,
        phaseOffset: Math.random() * Math.PI * 2,
        phaseSpeed: 0.008 + Math.random() * 0.012,
        alpha: 0.20 + (1 - t) * 0.35,
        lineWidth: 0.8 + Math.random() * 1.4,
      });
    }
    wavesRef.current = waves;

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      const time = timeRef.current;

      for (const wave of waves) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(20, 184, 166, ${wave.alpha})`;
        ctx.lineWidth = wave.lineWidth;
        const step = w / SEGMENTS;
        for (let s = 0; s <= SEGMENTS; s++) {
          const x = s * step;
          const y = getWaveY(wave, x, time, h);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      for (let x = 0; x <= w; x += MESH_SPACING) {
        for (let i = 0; i < waves.length - 1; i++) {
          const w1 = waves[i];
          const w2 = waves[i + 1];
          const y1 = getWaveY(w1, x, time, h);
          const y2 = getWaveY(w2, x, time, h);
          const a = Math.min(w1.alpha, w2.alpha) * 0.45;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.strokeStyle = `rgba(20, 184, 166, ${a})`;
          ctx.lineWidth = 0.3;
          ctx.stroke();
        }
      }

      for (let x = 0; x <= w; x += MESH_SPACING) {
        for (const wave of waves) {
          const y = getWaveY(wave, x, time, h);
          const dotAlpha = wave.alpha * 0.8;
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(45, 212, 191, ${dotAlpha})`;
          ctx.fill();
        }
      }

      timeRef.current += 1;
      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
