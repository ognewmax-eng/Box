import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tv, Smartphone, Sparkles, Settings } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-[#a855f7] rounded-full blur-[120px] opacity-20"
          animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#22d3ee] rounded-full blur-[120px] opacity-20"
          animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-12 h-12 text-[#a855f7]" />
          </div>
          <h1 className="text-6xl md:text-7xl font-black text-white mb-4 tracking-tight">
            BOX
            <span className="bg-gradient-to-r from-[#a855f7] via-[#22d3ee] to-[#fbbf24] bg-clip-text text-transparent">
              {' '}PARTY
            </span>
          </h1>
          <p className="text-xl text-gray-400">
            Локальная мультиплеерная викторина для вас и друзей
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link to="/host">
              <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a2e]/40 backdrop-blur-xl border border-white/10 p-8 hover:border-[#a855f7]/50 transition-all duration-300 hover:shadow-nexus-purple">
                <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#7c3aed] flex items-center justify-center mb-6 shadow-lg shadow-[#a855f7]/50">
                    <Tv className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3">Ведущий</h2>
                  <p className="text-gray-400 mb-6">
                    Запустите игру на ПК или телевизоре. Создайте комнату и покажите игрокам код или QR.
                  </p>
                  <div className="flex items-center text-[#a855f7] group-hover:translate-x-2 transition-transform duration-300">
                    <span className="font-bold mr-2">Начать</span>
                    <span className="text-2xl">→</span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link to="/client">
              <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a2e]/40 backdrop-blur-xl border border-white/10 p-8 hover:border-[#22d3ee]/50 transition-all duration-300 hover:shadow-nexus-cyan">
                <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#22d3ee] to-[#06b6d4] flex items-center justify-center mb-6 shadow-lg shadow-[#22d3ee]/50">
                    <Smartphone className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3">Игрок</h2>
                  <p className="text-gray-400 mb-6">
                    Подключитесь с телефона. Введите код комнаты и ник — и участвуйте в викторине.
                  </p>
                  <div className="flex items-center text-[#22d3ee] group-hover:translate-x-2 transition-transform duration-300">
                    <span className="font-bold mr-2">Войти в игру</span>
                    <span className="text-2xl">→</span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-gray-300 text-sm hover:bg-white/10 hover:border-[#a855f7]/30 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Админка
          </Link>
          {['Мультиплеер в реальном времени', 'Без установки', 'Викторины и раунды'].map((feature, index) => (
            <div
              key={index}
              className="px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-gray-300 text-sm"
            >
              {feature}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
