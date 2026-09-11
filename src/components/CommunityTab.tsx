import React from "react";
import { ArrowRight, BookOpen, Flame, LockKeyhole, Megaphone, ShieldCheck } from "lucide-react";
import { AdminSettings } from "../types";

interface CommunityTabProps {
  settings: AdminSettings;
  isAdmin: boolean;
  onOpenAdmin: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const CommunityTab: React.FC<CommunityTabProps> = ({
  settings,
  isAdmin,
  onOpenAdmin,
}) => {
  const activePosts = settings.notifications.filter((item) => item.isActive);
  const pastPosts = settings.notifications.filter((item) => !item.isActive);

  return (
    <div className="space-y-5">
      <section className="bg-[#FDA4AF] border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border-[2px] border-black rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <BookOpen size={13} /> Community teachings
            </div>
            <h1 className="text-[30px] font-black leading-none tracking-tighter mt-3">
              learn the game together
            </h1>
            <p className="text-[12px] font-bold opacity-75 mt-1">
              Fresh dating lessons, reminders, and straight-up guidance from the team.
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#FFE066] border-[2.5px] border-black flex items-center justify-center shrink-0">
            <Flame size={20} />
          </div>
        </div>
      </section>

      {activePosts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Megaphone size={18} />
            <h2 className="font-black text-[17px] tracking-tight">Pinned by the team</h2>
          </div>
          {activePosts.map((post) => (
            <article key={post.id} className="bg-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="bg-[#BEF264] border-[2px] border-black rounded-full px-2.5 py-1 text-[10px] font-black uppercase">
                  {post.tone === "win" ? "Win" : post.tone === "warning" ? "Real talk" : "Teaching"}
                </span>
                <span className="text-[10px] font-black uppercase opacity-50">{formatDate(post.createdAt)}</span>
              </div>
              <h3 className="font-black text-[20px] tracking-tight leading-tight">{post.title}</h3>
              <p className="mt-2 text-[13px] font-bold leading-relaxed opacity-75">{post.message}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className="bg-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#FFE066] border-[2.5px] border-black flex items-center justify-center">
            <BookOpen size={22} />
          </div>
          <h2 className="font-black text-[18px] mt-3">No new teachings yet</h2>
          <p className="text-[12px] font-bold opacity-60 mt-1">Check back soon for the next community drop.</p>
        </section>
      )}

      {pastPosts.length > 0 && (
        <section className="bg-[#FFFBEB] border-[3px] border-black rounded-[22px] p-5">
          <h2 className="font-black text-[16px] tracking-tight flex items-center gap-2">
            <BookOpen size={17} /> Previous teachings
          </h2>
          <div className="mt-3 space-y-2">
            {pastPosts.map((post) => (
              <div key={post.id} className="bg-white border-[2px] border-black rounded-[15px] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-[13px]">{post.title}</span>
                  <span className="text-[9px] font-black uppercase opacity-50">{formatDate(post.createdAt)}</span>
                </div>
                <p className="text-[11px] font-bold opacity-60 mt-1 line-clamp-2">{post.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-[#111] text-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FFE066] text-black border-[2px] border-white flex items-center justify-center shrink-0">
            {isAdmin ? <ShieldCheck size={19} /> : <LockKeyhole size={18} />}
          </div>
          <div>
            <h2 className="font-black text-[16px]">Community is a one-way teaching channel</h2>
            <p className="text-[11px] font-bold opacity-70 mt-1">
              Only verified admins can publish guidance. Everyone else gets the good stuff without the noise.
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="w-full h-11 mt-4 bg-[#FDA4AF] text-black border-[3px] border-white rounded-full font-black text-[12px] uppercase flex items-center justify-center gap-2"
          >
            Open teaching controls <ArrowRight size={16} />
          </button>
        )}
      </section>
    </div>
  );
};
