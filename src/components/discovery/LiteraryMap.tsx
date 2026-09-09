import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { Map, User, BookOpen, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MapNode {
  id: string;
  type: 'author' | 'book' | 'theme' | 'era';
  label: string;
  labelAr: string;
  x: number;
  y: number;
  data?: any;
}

interface MapEdge {
  from: string;
  to: string;
}

export const LiteraryMap: React.FC = () => {
  const { books, authors, language, openBookInReader, setDetailAuthor } = useAppStore();

  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'author' | 'book' | 'theme'>('all');
  const [zoomLevel, setZoomLevel] = useState(1);

  const t = translations[language];
  const isAr = language === 'ar';

  const nodes: MapNode[] = [
    ...authors.map((a, idx) => ({
      id: `auth-${a.id}`,
      type: 'author' as const,
      label: a.name,
      labelAr: a.nameAr,
      x: 180 + (idx % 3) * 220 + Math.sin(idx) * 40,
      y: 140 + Math.floor(idx / 3) * 240 + Math.cos(idx) * 30,
      data: a,
    })),

    ...books.map((b, idx) => ({
      id: `book-${b.id}`,
      type: 'book' as const,
      label: b.title,
      labelAr: b.titleAr,
      x: 120 + (idx % 4) * 190 + Math.cos(idx * 2) * 50,
      y: 220 + Math.floor(idx / 4) * 160 + Math.sin(idx * 2) * 40,
      data: b,
    })),
  ];

  const edges: MapEdge[] = books.map((b) => ({
    from: `auth-${b.authorId}`,
    to: `book-${b.id}`,
  }));

  const filteredNodes = nodes.filter((n) => filterType === 'all' || n.type === filterType);

  const getNodeColor = (type: MapNode['type']) => {
    switch (type) {
      case 'author':
        return '#B89A5A'; // Gold
      case 'book':
        return '#687B61'; // Moss Emerald
      case 'theme':
        return '#4A2528'; // Burgundy
      case 'era':
        return '#2D4A68'; // Blue
    }
  };

  return (
    <div id="literary-map-container" className="w-full space-y-6">
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#B89A5A]">
            <Map className="w-3.5 h-3.5" />
            <span>{isAr ? 'الخريطة الطوبوغرافية الفكرية' : 'Topographic Literary Graph'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">
            {t.map.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#89977C]">
            {t.map.subtitle}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#07110D] border border-[#173125]">
          {(['all', 'author', 'book'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                filterType === f ? 'bg-[#173125] text-[#D2BB82] shadow' : 'text-[#89977C] hover:text-[#E8E0CF]'
              }`}
            >
              {f === 'all' ? (isAr ? 'الكل' : 'All') : f === 'author' ? (isAr ? 'المؤلفون' : 'Authors') : (isAr ? 'الكتب' : 'Books')}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive 2D Graph Canvas Canvas */}
      <div className="relative w-full h-[620px] rounded-3xl bg-[#07110D] border border-[#173125] overflow-hidden shadow-2xl">
        
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 p-1.5 rounded-xl bg-[#0B1712] border border-[#173125] shadow-lg">
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
            className="p-1.5 text-[#89977C] hover:text-[#E8E0CF]"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
            className="p-1.5 text-[#89977C] hover:text-[#E8E0CF]"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 text-[#89977C] hover:text-[#E8E0CF]"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-20 p-3 rounded-2xl bg-[#0B1712]/90 border border-[#173125] backdrop-blur-md flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#B89A5A]" />
            <span className="text-[#E8E0CF]">{isAr ? 'مؤلف / مفكر' : 'Author'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#687B61]" />
            <span className="text-[#E8E0CF]">{isAr ? 'عمل أدبي' : 'Book'}</span>
          </div>
        </div>

        {/* SVG Graph Visualization */}
        <svg
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s' }}
        >
          {/* Edges */}
          {edges.map((edge, idx) => {
            const source = nodes.find((n) => n.id === edge.from);
            const target = nodes.find((n) => n.id === edge.to);
            if (!source || !target) return null;

            return (
              <line
                key={idx}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#173125"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Nodes */}
          {filteredNodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isAuthor = node.type === 'author';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(node)}
                className="cursor-pointer group"
              >
                <circle
                  r={isAuthor ? 22 : 14}
                  fill="#0B1712"
                  stroke={getNodeColor(node.type)}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="transition-all duration-200 group-hover:scale-125"
                />

                <circle
                  r={isAuthor ? 8 : 5}
                  fill={getNodeColor(node.type)}
                  className="transition-opacity opacity-70 group-hover:opacity-100"
                />

                <text
                  y={isAuthor ? 34 : 24}
                  textAnchor="middle"
                  fill="#E8E0CF"
                  fontSize={isAuthor ? "11px" : "9px"}
                  fontFamily="Literata, Amiri, serif"
                  fontWeight={isAuthor ? "bold" : "normal"}
                  className="select-none pointer-events-none drop-shadow"
                >
                  {isAr ? node.labelAr : node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Node Details Drawer */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: isAr ? -300 : 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? -300 : 300 }}
              className={`absolute top-4 bottom-4 w-80 p-5 rounded-2xl bg-[#0B1712]/95 border border-[#B89A5A]/60 shadow-2xl backdrop-blur-xl z-30 flex flex-col justify-between overflow-y-auto ${
                isAr ? 'left-4' : 'right-4'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#173125]">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82]">
                    {selectedNode.type}
                  </span>
                  <button onClick={() => setSelectedNode(null)} className="text-xs text-[#89977C] hover:text-[#E8E0CF]">
                    ✕
                  </button>
                </div>

                {selectedNode.type === 'author' && selectedNode.data && (
                  <div className="space-y-3">
                    <img
                      src={selectedNode.data.avatar}
                      alt={selectedNode.data.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#B89A5A] mx-auto shadow-lg"
                    />
                    <div className="text-center">
                      <h3 className="font-literary text-lg font-bold text-[#E8E0CF]">
                        {isAr ? selectedNode.data.nameAr : selectedNode.data.name}
                      </h3>
                      <div className="text-xs text-[#89977C]">
                        {isAr ? selectedNode.data.eraAr : selectedNode.data.era} • {selectedNode.data.country}
                      </div>
                    </div>
                    <p className="text-xs text-[#BDB5A5] leading-relaxed">
                      {isAr ? selectedNode.data.biographyAr : selectedNode.data.biography}
                    </p>
                  </div>
                )}

                {selectedNode.type === 'book' && selectedNode.data && (
                  <div className="space-y-3">
                    <img
                      src={selectedNode.data.coverImage}
                      alt={selectedNode.data.title}
                      className="w-20 h-28 rounded-lg object-cover border border-[#687B61] mx-auto shadow-lg"
                    />
                    <div className="text-center">
                      <h3 className="font-literary text-base font-bold text-[#E8E0CF]">
                        {isAr ? selectedNode.data.titleAr : selectedNode.data.title}
                      </h3>
                      <div className="text-xs text-[#89977C]">
                        {isAr ? selectedNode.data.authorNameAr : selectedNode.data.authorName} ({selectedNode.data.publicationYear})
                      </div>
                    </div>
                    <p className="text-xs text-[#BDB5A5] leading-relaxed line-clamp-3">
                      {isAr ? selectedNode.data.descriptionAr : selectedNode.data.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-[#173125]">
                {selectedNode.type === 'book' && (
                  <button
                    onClick={() => openBookInReader(selectedNode.data)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs transition-colors shadow"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{t.book.readNow}</span>
                  </button>
                )}
                {selectedNode.type === 'author' && (
                  <button
                    onClick={() => setDetailAuthor(selectedNode.data)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#173125] hover:bg-[#B89A5A] text-[#D2BB82] hover:text-[#07110D] font-bold text-xs transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{t.author.aboutAuthor}</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
