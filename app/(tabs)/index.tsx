import React from 'react';
import { DashboardScreen } from '../../src/features/dashboard/DashboardScreen.tsx';
import { useAppDispatch } from '../../src/store/hooks.ts';
import { fetchMeetings } from '../../src/store/slices/meetingsSlice.ts';

export default function IndexScreen() {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    dispatch(fetchMeetings());
  }, [dispatch]);

  return (
    <DashboardScreen
      onStartRecording={() => {}}
      onOpenMeeting={() => {}}
      onViewAllMeetings={() => {}}
      onViewActions={() => {}}
    />
  );
}
