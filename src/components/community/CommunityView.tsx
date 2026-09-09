import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { Users, MessageSquare, Star, Heart, BookOpen, ShieldCheck, Send, LoaderCircle } from 'lucide-react';

export const CommunityView: React.FC = () => {
  const { reviews, reviewComments, books, language, isAuthenticated, setDetailBook, loadCommunityFeed, loadReviewComments, toggleReviewLike, addReviewComment, requestStates } = useAppStore();
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const t = translations[language];
  const isAr = language === 'ar';
  const communityState = requestStates.reviews.community;

  useEffect(() => { void loadCommunityFeed(); }, []);

  const toggleThread = async (reviewId: string) => {
    const willOpen = !openThreads[reviewId];
    setOpenThreads((current) => ({ ...current, [reviewId]: willOpen }));
    if (willOpen) await loadReviewComments(reviewId);
  };

  const submitComment = async (reviewId: string) => {
    const content = (drafts[reviewId] || '').trim();
    if (!content) return;
    setSubmitting((current) => ({ ...current, [reviewId]: true }));
    const saved = await addReviewComment(reviewId, content);
    if (saved) setDrafts((current) => ({ ...current, [reviewId]: '' }));
    setSubmitting((current) => ({ ...current, [reviewId]: false }));
  };

  return (
    <div id="community-view-container" className="w-full space-y-6">
      <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#B89A5A]">
            <Users className="w-3.5 h-3.5" />
            <span>{isAr ? 'المجتمع الأدبي الهادئ' : 'Literary Circle & Reader Discussions'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">{t.community.title}</h1>
          <p className="text-xs sm:text-sm text-[#89977C]">{t.community.subtitle}</p>
        </div>
        <p className="text-xs text-[#89977C] max-w-sm md:text-end">
          {isAr ? 'المراجعات والإعجابات والنقاشات المعروضة هنا تأتي من المجتمع الفعلي فقط.' : 'Only persisted reader reviews, reactions, and discussion replies appear here.'}
        </p>
      </div>

      {communityState?.status === 'loading' && reviews.length === 0 && (
        <div role="status" className="p-10 rounded-3xl bg-[#0B1712] border border-[#173125] text-center text-sm text-[#89977C]">{isAr ? 'جارٍ تحميل نقاشات القراء…' : 'Loading reader discussions…'}</div>
      )}
      {communityState?.status === 'error' && (
        <div role="alert" className="p-5 rounded-2xl bg-[#2A1111] border border-[#8B3A3A] text-sm text-[#E8E0CF]">
          {isAr ? 'تعذر تحميل المجتمع الآن. أعد المحاولة.' : 'The community feed could not be loaded. Please try again.'}
          <button type="button" onClick={() => void loadCommunityFeed()} className="ms-3 underline text-[#D2BB82]">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
        </div>
      )}
      {communityState?.status === 'empty' && (
        <div className="p-12 rounded-3xl bg-[#0B1712] border border-[#173125] text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-[#687B61] mx-auto" />
          <h2 className="font-literary text-lg font-bold text-[#E8E0CF]">{isAr ? 'لا توجد مراجعات منشورة بعد' : 'No reader reviews have been published yet'}</h2>
          <p className="text-xs text-[#89977C]">{isAr ? 'ستظهر هنا المراجعات التي ينشرها القراء فعلياً.' : 'Published reviews will appear here as readers contribute them.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reviews.map((rev) => {
          const book = books.find((item) => item.id === rev.bookId);
          const isLiked = rev.likedByCurrentUser === true;
          const threadOpen = openThreads[rev.id] === true;
          const comments = reviewComments[rev.id] || [];
          return (
            <article key={rev.id} className="p-5 sm:p-6 rounded-3xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61]/60 transition-colors flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {rev.userAvatar ? <img src={rev.userAvatar} alt={rev.userName} className="w-10 h-10 rounded-full object-cover border border-[#687B61]/40" /> : <div aria-hidden="true" className="w-10 h-10 rounded-full bg-[#173125] text-[#D2BB82] grid place-items-center font-semibold">{rev.userName.slice(0, 1).toUpperCase()}</div>}
                    <div>
                      <div className="text-xs font-bold text-[#E8E0CF] flex items-center gap-1.5"><span>{rev.userName}</span>{rev.isVerifiedReader && <ShieldCheck className="w-3.5 h-3.5 text-[#687B61]" aria-label={isAr ? 'قارئ موثق' : 'Verified reader'} />}</div>
                      <div className="text-[10px] text-[#89977C] font-mono">{new Date(rev.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[#D2BB82] text-xs font-mono"><Star className="w-3.5 h-3.5 fill-[#D2BB82]" /><span>{rev.rating}</span></div>
                </div>
                <h2 className="font-literary text-base font-bold text-[#E8E0CF] pt-1">{rev.title}</h2>
                <p className="text-xs sm:text-sm text-[#BDB5A5] leading-relaxed">{rev.content}</p>
                {book && <button type="button" onClick={() => setDetailBook(book)} className="w-full text-start p-3 rounded-2xl bg-[#07110D] border border-[#173125] hover:border-[#687B61] flex items-center justify-between transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82]">
                  <span className="flex items-center gap-3 min-w-0"><img src={book.coverImage} alt="" className="w-8 h-11 object-cover rounded shadow shrink-0" /><span className="min-w-0"><span className="block text-xs font-bold text-[#E8E0CF] truncate">{isAr ? book.titleAr : book.title}</span><span className="block text-[10px] text-[#89977C] truncate">{isAr ? book.authorNameAr : book.authorName}</span></span></span><BookOpen className="w-4 h-4 text-[#89977C] shrink-0" />
                </button>}
              </div>
              <div className="pt-3 border-t border-[#173125] space-y-3 text-xs text-[#89977C]">
                <div className="flex items-center justify-between">
                  <button type="button" disabled={!isAuthenticated} onClick={() => void toggleReviewLike(rev.id, !isLiked)} className={`flex items-center gap-1.5 transition-colors disabled:opacity-50 ${isLiked ? 'text-[#E57373]' : 'hover:text-[#E8E0CF]'}`} aria-pressed={isLiked} title={isAuthenticated ? undefined : (isAr ? 'سجّل الدخول للتفاعل' : 'Sign in to react')}><Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} /><span>{rev.likes}</span></button>
                  <button type="button" onClick={() => void toggleThread(rev.id)} className="flex items-center gap-1.5 hover:text-[#E8E0CF] transition-colors" aria-expanded={threadOpen}><MessageSquare className="w-4 h-4" /><span>{isAr ? `نقاش (${rev.commentsCount ?? 0})` : `Discuss (${rev.commentsCount ?? 0})`}</span></button>
                </div>
                {threadOpen && <section aria-label={isAr ? 'نقاش المراجعة' : 'Review discussion'} className="space-y-3 pt-2">
                  {comments.length === 0 ? <p className="text-[11px] text-[#89977C]">{isAr ? 'لا توجد ردود بعد.' : 'No replies yet.'}</p> : comments.map((comment) => <div key={comment.id} className="rounded-xl bg-[#07110D] border border-[#173125] p-3"><p className="text-[11px] font-semibold text-[#D2BB82]">{comment.userName}</p><p className="text-xs text-[#BDB5A5] mt-1">{comment.content}</p></div>)}
                  {isAuthenticated ? <div className="flex gap-2"><label className="sr-only" htmlFor={`comment-${rev.id}`}>{isAr ? 'أضف رداً' : 'Add a reply'}</label><input id={`comment-${rev.id}`} value={drafts[rev.id] || ''} onChange={(event) => setDrafts((current) => ({ ...current, [rev.id]: event.target.value }))} maxLength={4000} placeholder={isAr ? 'اكتب رداً محترماً…' : 'Write a thoughtful reply…'} className="min-w-0 flex-1 bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs text-[#E8E0CF]" /><button type="button" disabled={submitting[rev.id] || !(drafts[rev.id] || '').trim()} onClick={() => void submitComment(rev.id)} className="p-2 rounded-xl bg-[#173125] text-[#D2BB82] disabled:opacity-50" aria-label={isAr ? 'إرسال الرد' : 'Send reply'}>{submitting[rev.id] ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button></div> : <p className="text-[11px] text-[#89977C]">{isAr ? 'سجّل الدخول لتضيف رداً أو إعجاباً.' : 'Sign in to add a reply or reaction.'}</p>}
                </section>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
