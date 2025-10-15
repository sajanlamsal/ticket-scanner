'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // Redirect to Mangal Events website
    window.location.replace('https://www.mangalevents.com');
  }, []);

  // Return null since we're redirecting
  return null;
}