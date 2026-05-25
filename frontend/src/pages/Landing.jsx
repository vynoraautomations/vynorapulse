import { ArrowRight, Bot, CheckCircle2, Cpu, Flame, Globe, Inbox, Layers, Radio, Rocket, ShieldOff, Sparkles, Target, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const features = [
  { icon: Bot, title: "Future Impact AI", text: "Deeply analyzes email content to predict relevance score, urgency, and estimated career importance." },
  { icon: ShieldOff, title: "Smart Spam Shield", text: "Instantly ignores distractions like Instagram, Snapchat, promotional newsletters, and shopping spam." },
  { icon: Radio, title: "Real-Time Polling & Alerts", text: "Continuous background monitoring with lightning-fast WhatsApp, Telegram, and browser notifications." },
  { icon: Layers, title: "Career Operating System", text: "Interactive opportunity feed, deadline radar, application tracker, and gamified AI career score." }
];

const sampleOpportunities = [
  { company: "Microsoft", role: "Software Engineering Intern", score: 98, urgency: "Critical", deadline: "Tomorrow, 11:59 PM", action: "Apply within 12 hours", tag: "Internship" },
  { company: "Google", role: "Online Assessment - Round 1", score: 95, urgency: "High", deadline: "In 2 days", action: "Complete coding test", tag: "OA Link" },
  { company: "JP Morgan", role: "Congratulations! Final Round Selection", score: 99, urgency: "Critical", deadline: "Action needed", action: "Confirm interview slot", tag: "Result" },
];

export default function Landing() {
  return (
    <div className="relative overflow-hidden bg-[#030712] text-slate-100 min-h-screen">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-10 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 lg:pt-24 lg:pb-32">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)] mb-6">
              <Sparkles size={14} className="text-cyan-400 animate-spin" /> NEXT-GENERATION CAREER OPERATING SYSTEM
            </div>

            <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.1]">
              Never Miss What <br />
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent filter drop-shadow-[0_0_35px_rgba(0,240,255,0.4)]">
                Changes Your Future.
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-slate-300 max-w-2xl font-light">
              An AI-powered Opportunity Intelligence platform that detects, filters, prioritizes, and summarizes high-value career emails hidden inside your inbox.
              <span className="font-semibold text-white block mt-2 text-cyan-200">
                Zero spam. Zero distractions. 100% focus on life-changing opportunities.
              </span>
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                className="group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:shadow-[0_0_45px_rgba(0,240,255,0.8)] transition-all duration-300 hover:scale-105"
                to="/login"
              >
                <span>Launch Vynora Pulse</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur px-8 py-4 text-base font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-all duration-200"
                href="#workflow"
              >
                <Cpu size={18} className="text-purple-400" /> Explore Features
              </a>
            </div>

            {/* Quick stats banner */}
            <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-3 gap-6 text-center sm:text-left">
              <div>
                <p className="font-display font-extrabold text-3xl text-white">99.8%</p>
                <p className="text-xs uppercase font-mono text-cyan-400 mt-1">Opportunity Detection</p>
              </div>
              <div>
                <p className="font-display font-extrabold text-3xl text-white">Zero</p>
                <p className="text-xs uppercase font-mono text-purple-400 mt-1">Spam & Distraction</p>
              </div>
              <div>
                <p className="font-display font-extrabold text-3xl text-white"><Zap size={24} className="inline text-pink-500 fill-pink-500" /> <Rocket size={24} className="inline text-cyan-400" /></p>
                <p className="text-xs uppercase font-mono text-pink-400 mt-1">Instant Multi-Channel Alerts</p>
              </div>
            </div>
          </motion.div>

          {/* Right Hero: Live Opportunity Showcase Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-purple-500/20 to-pink-500/20 blur-2xl" />
            <div className="relative rounded-3xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs uppercase tracking-widest font-mono font-bold text-cyan-400">Future Impact AI Feed</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">Live Simulation</span>
              </div>

              <div className="space-y-4">
                {sampleOpportunities.map((opp, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 + idx * 0.2 }}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 relative overflow-hidden group hover:border-cyan-500/50 transition-all duration-300 shadow-lg"
                  >
                    <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l from-cyan-500/20 to-transparent rounded-bl-xl border-l border-b border-cyan-500/30 text-[11px] font-mono font-bold text-cyan-300">
                      🎯 Match {opp.score}%
                    </div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className="text-xs font-semibold text-slate-400">{opp.company}</span>
                        <h3 className="font-display font-bold text-base text-white group-hover:text-cyan-300 transition-colors">{opp.role}</h3>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium flex items-center gap-1 font-mono">
                        <Flame size={12} className="fill-rose-500 text-rose-500" /> {opp.urgency} Urgency
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 font-medium">
                        ⏳ {opp.deadline}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-medium ml-auto">
                        {opp.tag}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                      <span>⚡ Action: <strong className="text-white">{opp.action}</strong></span>
                      <span className="text-cyan-400 font-semibold group-hover:underline cursor-pointer flex items-center gap-1">Open <ArrowRight size={12} /></span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <ShieldOff size={20} />
                </div>
                <div className="text-xs text-rose-200">
                  <p className="font-bold text-rose-300">Smart Spam Shield Active</p>
                  <p className="text-slate-400 font-light mt-0.5">542 promotional shopping & social media emails filtered automatically.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="workflow" className="relative border-t border-slate-900 bg-slate-950/40 py-24 px-4 sm:px-6 backdrop-blur-md">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
              Engineered for the Ambitious.
            </h2>
            <p className="mt-4 text-slate-400">
              Every feature in Vynora Pulse is meticulously crafted to ensure you dominate your placement season and professional career.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 hover:border-cyan-500/50 hover:bg-slate-900 transition-all duration-300 group shadow-xl hover:shadow-[0_0_30px_rgba(0,240,255,0.15)] flex flex-col justify-between"
              >
                <div>
                  <div className="mb-6 inline-flex p-4 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 group-hover:scale-110 transition-transform">
                    <feat.icon size={28} />
                  </div>
                  <h3 className="font-display font-bold text-xl text-white group-hover:text-cyan-300 transition-colors">{feat.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400 font-light">{feat.text}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 text-xs font-mono font-semibold text-slate-500 group-hover:text-cyan-400 flex items-center justify-between">
                  <span>VYNORA PULSE</span>
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Focus Areas Showcase */}
          <div className="mt-20 pt-16 border-t border-slate-900">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h3 className="font-display font-extrabold text-2xl text-white">Specially Tuned For Your Ambitions</h3>
              <p className="text-xs font-mono text-cyan-400 mt-1 uppercase tracking-widest">Real-time classification engines active</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { title: "EAMCET Counselling", desc: "Seat allotments, rank predictors & college alerts", icon: Target, color: "from-cyan-500 to-blue-600" },
                { title: "Jobs & HR Rounds", desc: "Direct recruiter communications & interview links", icon: Inbox, color: "from-purple-500 to-indigo-600" },
                { title: "Internships", desc: "Top tech internships & stipend details", icon: Sparkles, color: "from-pink-500 to-rose-600" },
                { title: "Coding Hackathons", desc: "Hackerrank, LeetCode & competitive programming", icon: Cpu, color: "from-amber-500 to-orange-600" },
                { title: "Tech Events", desc: "Webinars, tech fests & campus symposiums", icon: Radio, color: "from-emerald-500 to-teal-600" },
                { title: "Coupons & Offers", desc: "Special discounts, student perks & B2B deals", icon: Zap, color: "from-blue-500 to-purple-600" },
              ].map((item, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col items-center text-center group hover:border-cyan-500/40 transition-all duration-300 shadow">
                  <div className={`p-3 rounded-xl bg-gradient-to-tr ${item.color} text-white mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                    <item.icon size={20} />
                  </div>
                  <h4 className="font-display font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 font-light mt-1 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Call to action section */}
      <section className="relative py-24 px-4 text-center">
        <div className="max-w-4xl mx-auto rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-12 shadow-[0_0_50px_rgba(0,240,255,0.25)] relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 mb-6 shadow-md shadow-amber-500/10">
            <Zap size={14} className="text-amber-400" /> NORMAL PLAN — ₹29 / MONTH
          </div>

          <h2 className="font-display text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
            Stop checking spam. <br />
            <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">Start securing offers.</span>
          </h2>
          <p className="mt-4 text-slate-300 max-w-xl mx-auto text-base font-light">
            Join thousands of engineering students and elite professionals who rely on Vynora Pulse to manage their career opportunities.
          </p>
          <div className="mt-10">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 px-10 py-5 text-lg font-bold text-white shadow-[0_0_35px_rgba(0,240,255,0.6)] hover:shadow-[0_0_55px_rgba(0,240,255,0.9)] transition-all duration-300 hover:scale-105"
            >
              <Rocket size={22} />
              <span>Start Your ₹29 Plan</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

