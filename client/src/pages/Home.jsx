import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="min-h-screen bg-party-dark flex flex-col items-center justify-center p-6 bg-gradient-to-b from-party-dark to-purple-950/20">
      <motion.h1
        className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-party-neon via-party-pink to-party-cyan mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Box Party
      </motion.h1>
      <motion.p
        className="text-slate-400 text-lg mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Локальная мультиплеерная викторина
      </motion.p>
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Link
          to="/host"
          className="px-8 py-4 rounded-2xl bg-party-purple hover:bg-party-neon text-white font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-purple-500/30"
        >
          Ведущий (ПК)
        </Link>
        <Link
          to="/client"
          className="px-8 py-4 rounded-2xl bg-party-pink/80 hover:bg-party-pink text-white font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-pink-500/30"
        >
          Игрок (телефон)
        </Link>
        <Link
          to="/admin"
          className="px-8 py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-lg transition-all hover:scale-105"
        >
          Админка
        </Link>
      </motion.div>
    </div>
  );
}
