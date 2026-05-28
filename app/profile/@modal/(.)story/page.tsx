import { CvStoryInterviewModal } from '@/components/profile/CvStoryInterviewModal';

/**
 * Intercepting route. When the user is on /profile and clicks a soft link
 * to /profile/story, this route fires inside the @modal parallel slot and
 * renders the interview workspace as a modal over /profile. A hard nav
 * (direct URL, refresh, new tab, the "Open in full view" link inside the
 * modal) falls through to /profile/story/page.tsx and renders the
 * standalone full-page workspace.
 *
 * (.) means "intercept from the same level", since both this slot and the
 * standalone story route sit directly under /profile.
 */
export default function InterceptedStoryModal() {
  return <CvStoryInterviewModal />;
}
