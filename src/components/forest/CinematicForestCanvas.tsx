import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Sparkles, Wind, Moon, Sun, CloudRain, Compass, Maximize2, Minimize2 } from 'lucide-react';

export type ForestWeather = 'golden-dawn' | 'midnight-twilight' | 'misty-rain' | 'aurora-mystica';

interface FallingLeaf {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  color: string;
  alpha: number;
}

interface Firefly {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulseOffset: number;
  color: string;
  hue: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface Props {
  className?: string;
  showControls?: boolean;
  interactive?: boolean;
  onSelectBookNode?: (bookId: string) => void;
}

export const CinematicForestCanvas: React.FC<Props> = ({
  className = '',
  showControls = true,
}) => {
  const { language } = useAppStore();
  const isAr = language === 'ar';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weather, setWeather] = useState<ForestWeather>('golden-dawn');
  const [windIntensity, setWindIntensity] = useState<number>(1.2);
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);
  const [, setActiveRippleCount] = useState<number>(0);

  const mouseRef = useRef<{ x: number; y: number; isDown: boolean; targetWind: number }>({
    x: -1000,
    y: -1000,
    isDown: false,
    targetWind: 0,
  });

  const ripplesRef = useRef<Ripple[]>([]);
  const fallingLeavesRef = useRef<FallingLeaf[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);

  const triggerMagicalPulse = useCallback((x: number, y: number) => {
    const colors = {
      'golden-dawn': 'rgba(218, 165, 32,',
      'midnight-twilight': 'rgba(120, 200, 255,',
      'misty-rain': 'rgba(140, 190, 170,',
      'aurora-mystica': 'rgba(160, 240, 190,',
    };

    ripplesRef.current.push({
      x,
      y,
      radius: 5,
      maxRadius: 180 + Math.random() * 80,
      alpha: 1,
      color: colors[weather],
    });

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5);
      const speed = 2 + Math.random() * 3;
      firefliesRef.current.push({
        x,
        y,
        radius: 1.5 + Math.random() * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        baseAlpha: 0.9,
        pulseSpeed: 0.05,
        pulseOffset: Math.random() * Math.PI,
        color: weather === 'midnight-twilight' ? '#93C5FD' : '#FDE047',
        hue: 45,
      });
    }
  }, [weather]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let isVisible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let displayWidth = canvas.parentElement?.clientWidth || window.innerWidth;
    let displayHeight = canvas.parentElement?.clientHeight || 600;

    const setupCanvasDimensions = () => {
      if (!canvas.parentElement) return;
      displayWidth = canvas.parentElement.clientWidth;
      displayHeight = canvas.parentElement.clientHeight;
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setupCanvasDimensions();

    const handleResize = () => {
      setupCanvasDimensions();
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Performance Optimization: Pause rendering when tab is hidden or element is scrolled off-screen
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting && !document.hidden;
        });
      },
      { threshold: 0.05 }
    );
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    // Initialize fireflies with pre-calculated static values
    firefliesRef.current = Array.from({ length: 42 }).map(() => ({
      x: Math.random() * displayWidth,
      y: Math.random() * displayHeight,
      radius: Math.random() * 2.0 + 0.8,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.35 - 0.12,
      baseAlpha: Math.random() * 0.55 + 0.35,
      pulseSpeed: Math.random() * 0.025 + 0.015,
      pulseOffset: Math.random() * Math.PI * 2,
      color: '#D2BB82',
      hue: Math.random() > 0.5 ? 45 : 140,
    }));

    fallingLeavesRef.current = Array.from({ length: 24 }).map(() => ({
      x: Math.random() * displayWidth,
      y: Math.random() * displayHeight,
      size: 4 + Math.random() * 5,
      vx: Math.random() * 1.2 + 0.4,
      vy: Math.random() * 1.0 + 0.5,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.04,
      color: Math.random() > 0.5 ? '#B89A5A' : '#687B61',
      alpha: Math.random() * 0.65 + 0.35,
    }));

    let frame = 0;
    let lastTime = performance.now();

    const drawTree = (
      startX: number,
      startY: number,
      length: number,
      angle: number,
      depth: number,
      branchWidth: number,
      treeIndex: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const mouseDist = Math.hypot(startX - mouseRef.current.x, startY - mouseRef.current.y);
      const mouseInfluence = Math.max(0, 1 - mouseDist / 320) * (mouseRef.current.x < startX ? 0.07 : -0.07);

      const naturalWind = Math.sin(frame * 0.02 * windIntensity + treeIndex + depth * 0.3) * (0.032 * windIntensity);
      const totalAngle = angle + naturalWind + mouseInfluence;

      const endX = startX + Math.cos(totalAngle) * length;
      const endY = startY + Math.sin(totalAngle) * length;

      ctx.lineTo(endX, endY);
      ctx.lineWidth = branchWidth;
      ctx.lineCap = 'round';

      if (weather === 'midnight-twilight') {
        ctx.strokeStyle = `rgba(${18 + depth * 8}, ${35 + depth * 6}, ${30 + depth * 10}, 0.95)`;
      } else if (weather === 'golden-dawn') {
        ctx.strokeStyle = `rgba(${30 + depth * 12}, ${22 + depth * 8}, ${14 + depth * 4}, 0.95)`;
      } else if (weather === 'aurora-mystica') {
        ctx.strokeStyle = `rgba(${20 + depth * 6}, ${45 + depth * 10}, ${35 + depth * 8}, 0.95)`;
      } else {
        ctx.strokeStyle = `rgba(${22 + depth * 6}, ${32 + depth * 6}, ${28 + depth * 6}, 0.95)`;
      }

      ctx.stroke();

      if (depth <= 2) {
        const leafRadius = depth === 1 ? 6.5 : 4.5;
        const leafCount = 3;

        for (let i = 0; i < leafCount; i++) {
          const lAngle = totalAngle + (i - 1) * 0.45 + Math.sin(frame * 0.03 + i) * 0.08;
          const lx = endX + Math.cos(lAngle) * (length * 0.38);
          const ly = endY + Math.sin(lAngle) * (length * 0.38);

          ctx.beginPath();
          ctx.arc(lx, ly, leafRadius + Math.sin(frame * 0.05 + i) * 1.2, 0, Math.PI * 2);

          if (weather === 'golden-dawn') {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(218, 165, 32, 0.7)' : 'rgba(104, 123, 97, 0.75)';
          } else if (weather === 'midnight-twilight') {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(96, 165, 250, 0.75)' : 'rgba(52, 211, 153, 0.65)';
          } else if (weather === 'aurora-mystica') {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(52, 211, 153, 0.8)' : 'rgba(216, 180, 254, 0.75)';
          } else {
            ctx.fillStyle = 'rgba(104, 123, 97, 0.65)';
          }

          ctx.fill();
        }
      }

      if (depth > 0) {
        const subLength = length * (0.74 + Math.sin(treeIndex) * 0.035);
        const branchSplit = 0.42 + Math.sin(treeIndex + depth) * 0.07;

        drawTree(endX, endY, subLength, totalAngle - branchSplit, depth - 1, branchWidth * 0.68, treeIndex + 1);
        drawTree(endX, endY, subLength, totalAngle + branchSplit, depth - 1, branchWidth * 0.68, treeIndex + 2);

        if (depth >= 4) {
          drawTree(endX, endY, subLength * 0.7, totalAngle, depth - 2, branchWidth * 0.5, treeIndex + 3);
        }
      }
    };

    const render = (currentTime: number) => {
      animId = requestAnimationFrame(render);

      if (!isVisible) return;

      lastTime = currentTime;
      frame++;

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // 1. Weather Sky Gradient Backdrop
      const skyGrad = ctx.createLinearGradient(0, 0, 0, displayHeight);
      if (weather === 'golden-dawn') {
        skyGrad.addColorStop(0, '#060E0A');
        skyGrad.addColorStop(0.4, '#0D1E16');
        skyGrad.addColorStop(0.75, '#1E2416');
        skyGrad.addColorStop(1, '#08120D');
      } else if (weather === 'midnight-twilight') {
        skyGrad.addColorStop(0, '#03070B');
        skyGrad.addColorStop(0.4, '#061118');
        skyGrad.addColorStop(0.8, '#081817');
        skyGrad.addColorStop(1, '#050D0A');
      } else if (weather === 'aurora-mystica') {
        skyGrad.addColorStop(0, '#040F11');
        skyGrad.addColorStop(0.35, '#0A1E1E');
        skyGrad.addColorStop(0.7, '#13281E');
        skyGrad.addColorStop(1, '#05100B');
      } else {
        skyGrad.addColorStop(0, '#050B09');
        skyGrad.addColorStop(0.5, '#0B1713');
        skyGrad.addColorStop(0.9, '#12201B');
        skyGrad.addColorStop(1, '#07100D');
      }

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      // 2. Aurora or God Rays
      if (weather === 'aurora-mystica') {
        ctx.save();
        for (let i = 0; i < 3; i++) {
          const aGrad = ctx.createRadialGradient(
            displayWidth * (0.3 + i * 0.25) + Math.sin(frame * 0.01 + i) * 60,
            displayHeight * 0.2,
            10,
            displayWidth * (0.3 + i * 0.25),
            displayHeight * 0.3,
            displayWidth * 0.4
          );
          aGrad.addColorStop(0, i % 2 === 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(168, 85, 247, 0.12)');
          aGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = aGrad;
          ctx.fillRect(0, 0, displayWidth, displayHeight * 0.7);
        }
        ctx.restore();
      } else if (weather === 'golden-dawn') {
        ctx.save();
        const rayGrad = ctx.createLinearGradient(displayWidth * 0.7, 0, displayWidth * 0.3, displayHeight);
        rayGrad.addColorStop(0, 'rgba(253, 224, 71, 0.14)');
        rayGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.05)');
        rayGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(displayWidth * 0.65, 0);
        ctx.lineTo(displayWidth * 0.85, 0);
        ctx.lineTo(displayWidth * 0.4, displayHeight);
        ctx.lineTo(displayWidth * 0.1, displayHeight);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 3. Cinematic Rolling Fog / Mist Layer
      ctx.save();
      const fogAlpha = weather === 'misty-rain' ? 0.22 : 0.1;
      const fogGrad = ctx.createLinearGradient(0, displayHeight * 0.6, 0, displayHeight);
      fogGrad.addColorStop(0, 'rgba(104, 123, 97, 0)');
      fogGrad.addColorStop(1, `rgba(180, 200, 180, ${fogAlpha})`);
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, displayHeight * 0.55, displayWidth, displayHeight * 0.45);
      ctx.restore();

      // 4. Draw Procedural Trees in Background & Foreground
      const treeConfigs = [
        { x: displayWidth * 0.08, y: displayHeight + 10, length: displayHeight * 0.24, angle: -Math.PI / 2 + 0.05, depth: 5, width: 14, idx: 1 },
        { x: displayWidth * 0.25, y: displayHeight + 20, length: displayHeight * 0.32, angle: -Math.PI / 2 - 0.04, depth: 6, width: 18, idx: 2 },
        { x: displayWidth * 0.52, y: displayHeight + 30, length: displayHeight * 0.36, angle: -Math.PI / 2 + 0.02, depth: 6, width: 22, idx: 3 },
        { x: displayWidth * 0.78, y: displayHeight + 15, length: displayHeight * 0.30, angle: -Math.PI / 2 + 0.06, depth: 5, width: 16, idx: 4 },
        { x: displayWidth * 0.94, y: displayHeight + 10, length: displayHeight * 0.22, angle: -Math.PI / 2 - 0.08, depth: 5, width: 13, idx: 5 },
      ];

      treeConfigs.forEach((tc) => {
        drawTree(tc.x, tc.y, tc.length, tc.angle, tc.depth, tc.width, tc.idx);
      });

      // 5. Render Rain (if weather === 'misty-rain')
      if (weather === 'misty-rain') {
        ctx.strokeStyle = 'rgba(180, 220, 210, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 50; i++) {
          const rx = (frame * 12 + i * 47) % displayWidth;
          const ry = (frame * 18 + i * 31) % displayHeight;
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 2 * windIntensity, ry + 16);
        }
        ctx.stroke();
      }

      // 6. Render Falling Foliage Leaves
      fallingLeavesRef.current.forEach((l) => {
        l.x += l.vx * windIntensity;
        l.y += l.vy;
        l.rotation += l.vRot;

        if (l.y > displayHeight + 20) {
          l.y = -10;
          l.x = Math.random() * displayWidth;
        }
        if (l.x > displayWidth + 20) {
          l.x = -10;
        }

        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rotation);
        ctx.fillStyle = l.color;
        ctx.globalAlpha = l.alpha;
        ctx.beginPath();
        ctx.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 7. Render Magical Ripples
      const activeRipples: Ripple[] = [];
      ripplesRef.current.forEach((r) => {
        r.radius += 3.5;
        r.alpha *= 0.96;

        if (r.alpha > 0.02 && r.radius < r.maxRadius) {
          activeRipples.push(r);
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `${r.color} ${r.alpha})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      });
      ripplesRef.current = activeRipples;

      // 8. Render Fireflies & Spirit Particles
      firefliesRef.current.forEach((p) => {
        p.x += p.vx + Math.sin(frame * 0.02 + p.pulseOffset) * 0.3 * windIntensity;
        p.y += p.vy;

        if (p.x < 0) p.x = displayWidth;
        if (p.x > displayWidth) p.x = 0;
        if (p.y < 0) p.y = displayHeight;
        if (p.y > displayHeight) p.y = 0;

        const currentAlpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(frame * p.pulseSpeed + p.pulseOffset));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = weather === 'midnight-twilight'
          ? `rgba(147, 197, 253, ${currentAlpha})`
          : weather === 'aurora-mystica'
          ? `rgba(110, 231, 183, ${currentAlpha})`
          : `rgba(253, 224, 71, ${currentAlpha})`;
        ctx.fill();
      });

      // 9. Interactive Mouse Light Aura
      if (mouseRef.current.x > 0 && mouseRef.current.y > 0) {
        const mouseAura = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          130
        );
        mouseAura.addColorStop(0, 'rgba(210, 187, 130, 0.16)');
        mouseAura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mouseAura;
        ctx.beginPath();
        ctx.arc(mouseRef.current.x, mouseRef.current.y, 130, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, [weather, windIntensity]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
  };

  const handleMouseLeave = () => {
    mouseRef.current.x = -1000;
    mouseRef.current.y = -1000;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    triggerMagicalPulse(clickX, clickY);
    setActiveRippleCount((c) => c + 1);
  };

  return (
    <div
      id="cinematic-forest-hero"
      className={`relative w-full rounded-3xl overflow-hidden border border-[#173125] shadow-2xl transition-all duration-500 ${
        isCinemaMode ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[620px]'
      } ${className}`}
    >
      {/* 60FPS Living Botanical Simulation Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
        className="absolute inset-0 w-full h-full cursor-crosshair z-0"
      />

      {/* Atmospheric Overlays & Vignette */}
      <div className="absolute inset-0 bg-radial from-transparent via-[#07110D]/30 to-[#07110D]/90 pointer-events-none z-10" />

      {/* Top Cinematic HUD & Controls */}
      {showControls && (
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
          
          {/* Weather Selector Badge Group */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0B1712]/90 border border-[#173125]/80 backdrop-blur-md shadow-xl">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#89977C] px-2">
              {isAr ? 'الطقس الحي' : 'Weather'}
            </span>
            
            {[
              { id: 'golden-dawn', label: isAr ? 'فجر الحكمة' : 'Golden Dawn', icon: Sun, color: '#D2BB82' },
              { id: 'midnight-twilight', label: isAr ? 'ليل النجوم' : 'Midnight', icon: Moon, color: '#93C5FD' },
              { id: 'misty-rain', label: isAr ? 'رذاذ المطر' : 'Misty Rain', icon: CloudRain, color: '#687B61' },
              { id: 'aurora-mystica', label: isAr ? 'الشفق الأسطوري' : 'Aurora', icon: Sparkles, color: '#34D399' },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = weather === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setWeather(item.id as ForestWeather)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#173125] text-[#E8E0CF] border border-[#B89A5A]/60 shadow-lg scale-105'
                      : 'text-[#89977C] hover:text-[#E8E0CF] hover:bg-[#10231A]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Wind & Magic Controls */}
          <div className="flex items-center gap-2">
            {/* Summon Wind Breeze */}
            <button
              onClick={() => {
                setWindIntensity((w) => (w > 2.5 ? 0.8 : w + 0.8));
                const canvas = canvasRef.current;
                if (canvas) {
                  triggerMagicalPulse(canvas.width / 2, canvas.height * 0.7);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B1712]/90 border border-[#173125] hover:border-[#D2BB82] text-xs font-bold text-[#D2BB82] hover:text-[#E8E0CF] backdrop-blur-md transition-all shadow-lg"
              title={isAr ? 'إطلاق نسيم الريح الأسطوري' : 'Summon Forest Breeze'}
            >
              <Wind className="w-4 h-4 animate-pulse" />
              <span className="hidden md:inline">{isAr ? 'نسيم الريح' : 'Breeze'}</span>
              <span className="text-[10px] font-mono opacity-70">x{windIntensity.toFixed(1)}</span>
            </button>

            {/* Cinema Fullscreen Mode */}
            <button
              onClick={() => setIsCinemaMode(!isCinemaMode)}
              className="p-2 rounded-xl bg-[#0B1712]/90 border border-[#173125] hover:border-[#687B61] text-[#89977C] hover:text-[#E8E0CF] backdrop-blur-md transition-colors"
              title={isAr ? 'وضع السينما الكامل' : 'Cinema Mode'}
            >
              {isCinemaMode ? <Minimize2 className="w-4 h-4 text-[#D2BB82]" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Poetic Atmospheric Caption */}
      <div className="absolute bottom-6 left-6 right-6 z-20 flex items-end justify-between pointer-events-none">
        <div className="space-y-1 bg-[#07110D]/80 backdrop-blur-md p-4 rounded-2xl border border-[#173125]/80 max-w-md pointer-events-auto">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#B89A5A]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'دوحة الأدب الحية' : 'Living Literary Canopy'}</span>
          </div>
          <p className="font-literary text-xs sm:text-sm text-[#E8E0CF] leading-relaxed">
            {isAr
              ? 'تتفاعل أغصان الأشجار وأوراقها مع حركة يدك ونسمات الفكر، كل نبضة تضيء فصول المعرفة.'
              : 'The branches and foliage sway in synchrony with your focus and wind physics. Touch anywhere to cast pulses of insight.'}
          </p>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#89977C] bg-[#07110D]/70 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-[#173125]">
          <Compass className="w-3.5 h-3.5 text-[#B89A5A]" />
          <span>{isAr ? 'انقر على الشاشة لإطلاق تموجات النور' : 'Click canvas to summon light waves'}</span>
        </div>
      </div>
    </div>
  );
};
