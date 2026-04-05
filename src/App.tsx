/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Star, 
  Trash2, 
  ExternalLink, 
  X, 
  Film, 
  Tv, 
  ChevronRight,
  Edit2,
  AlertCircle,
  Loader2,
  Settings,
  Key,
  Users,
  WifiOff,
  Check,
  Clock,
  Dice5
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    firebase: any;
  }
}

// Types
type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
type EntryType = 'movie' | 'series' | 'watchlist';

interface Entry {
  id: string; // IMDB ID
  title: string;
  year: string;
  type: 'movie' | 'series';
  poster: string;
  tier?: Tier;
  rating?: number; // 0-10
  imdbRating?: string;
  plot?: string;
  genre?: string;
  actors?: string;
  runtime?: string;
  imdbUrl: string;
  addedAt: number;
}

const DEFAULT_OMDB_API_KEY = "442d43ab";
const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
const RATINGS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

const TIER_COLORS: Record<Tier, string> = {
  S: 'text-white border-gold bg-gold-shimmer/10 shadow-[0_0_20px_rgba(255,215,0,0.3)]',
  A: 'text-slate-200 border-slate-200/40 shadow-[0_0_15px_rgba(226,232,240,0.1)]',
  B: 'text-slate-300 border-slate-300/40 shadow-[0_0_15px_rgba(203,213,225,0.1)]',
  C: 'text-slate-400 border-slate-400/40 shadow-[0_0_15px_rgba(148,163,184,0.1)]',
  D: 'text-slate-500 border-slate-500/40 shadow-[0_0_15px_rgba(100,116,139,0.1)]',
  E: 'text-slate-600 border-slate-600/40 shadow-[0_0_15px_rgba(71,85,105,0.1)]',
  F: 'text-slate-700 border-slate-700/40 shadow-[0_0_15px_rgba(51,65,85,0.1)]',
};

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=300&h=450";

const getHighResPoster = (url: string) => {
  if (!url || url === PLACEHOLDER_IMAGE || url === "N/A") return url;
  // Replace resolution segments like _SX300, _SY300, _V1_SX300 with _SX800
  return url.replace(/_S[XY]\d+/g, '_SX800');
};

const SearchPoster = ({ src, alt }: { src: string; alt: string }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError || !src || src === "N/A") {
    return (
      <div className="w-[42px] h-[60px] bg-white/[0.05] rounded-[6px] flex items-center justify-center shrink-0 border border-white/[0.08]">
        <Film className="w-5 h-5 text-neutral-600" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      onError={() => setHasError(true)}
      className="w-[42px] h-[60px] object-cover rounded-[6px] shadow-lg shrink-0"
      referrerPolicy="no-referrer"
    />
  );
};

export default function App() {
  // State
  const [entries, setEntries] = useState<Entry[]>([]);
  const [watchlist, setWatchlist] = useState<Entry[]>([]);
  const [activeTab, setActiveTab] = useState<EntryType>('movie');
  const [viewMode, setViewMode] = useState<'tier' | 'rating'>('tier');
  const [imdbInput, setImdbInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  
  // Multi-user state
  const [username, setUsername] = useState<string | null>(localStorage.getItem('cinerank_username'));
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(!localStorage.getItem('cinerank_username'));
  const [isGroupView, setIsGroupView] = useState(false);
  const [allUsersData, setAllUsersData] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [welcomeInput, setWelcomeInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [sharedWatchlist, setSharedWatchlist] = useState<any[]>([]);
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  
  // Search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Click outside search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const firebaseConfig = {
    apiKey: "AIzaSyCTMMDFUPEecljWtzxr-qM37M_P1d-tSxc",
    authDomain: "sceanit-cfe7d.firebaseapp.com",
    projectId: "sceanit-cfe7d",
    databaseURL: "https://sceanit-cfe7d-default-rtdb.europe-west1.firebasedatabase.app",
    storageBucket: "sceanit-cfe7d.firebasestorage.app",
    messagingSenderId: "611563632379",
    appId: "1:611563632379:web:c16c4a4a1e82fbf759a25e"
  };

  // Initialize Firebase
  useEffect(() => {
    if (window.firebase && !window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    
    if (window.firebase) {
      const connectedRef = window.firebase.database().ref(".info/connected");
      connectedRef.on("value", (snap: any) => {
        setIsOffline(snap.val() === false);
      });
    }
  }, []);

  // Load data from Firebase
  useEffect(() => {
    if (!username || !window.firebase) return;

    const db = window.firebase.database();
    const userRef = db.ref(`users/${username}`);

    userRef.once('value', (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        if (data.ratings) {
          const ratingsArray = Object.values(data.ratings) as Entry[];
          setEntries(ratingsArray);
        }
        if (data.watchlist) {
          const watchlistArray = Object.values(data.watchlist) as Entry[];
          setWatchlist(watchlistArray);
        }
      } else {
        // Migration logic
        const localEntries = localStorage.getItem('cinerank_entries');
        const localWatchlist = localStorage.getItem('cinerank_watchlist');
        
        if (localEntries || localWatchlist) {
          const parsedEntries = localEntries ? JSON.parse(localEntries) : [];
          const parsedWatchlist = localWatchlist ? JSON.parse(localWatchlist) : [];
          
          setEntries(parsedEntries);
          setWatchlist(parsedWatchlist);
          
          // Save to Firebase immediately
          if (parsedEntries.length > 0) {
            const ratingsObj = parsedEntries.reduce((acc: any, curr: Entry) => {
              acc[curr.id] = curr;
              return acc;
            }, {});
            userRef.child('ratings').set(ratingsObj);
          }
          if (parsedWatchlist.length > 0) {
            const watchlistObj = parsedWatchlist.reduce((acc: any, curr: Entry) => {
              acc[curr.id] = curr;
              return acc;
            }, {});
            userRef.child('watchlist').set(watchlistObj);
          }
        }
      }
    });

    // Listen for changes from other devices/tabs
    userRef.on('value', (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        if (data.ratings) setEntries(Object.values(data.ratings));
        if (data.watchlist) setWatchlist(Object.values(data.watchlist));
      }
    });

    return () => userRef.off();
  }, [username]);

  // Save to Firebase
  const syncToFirebase = (newEntries: Entry[], newWatchlist: Entry[]) => {
    if (!username || !window.firebase) return;
    const db = window.firebase.database();
    const userRef = db.ref(`users/${username}`);
    
    const ratingsObj = newEntries.reduce((acc: any, curr: Entry) => {
      acc[curr.id] = curr;
      return acc;
    }, {});
    
    const watchlistObj = newWatchlist.reduce((acc: any, curr: Entry) => {
      acc[curr.id] = curr;
      return acc;
    }, {});

    userRef.child('ratings').set(ratingsObj);
    userRef.child('watchlist').set(watchlistObj);
  };

  // Fetch all users for Group View
  useEffect(() => {
    if (isGroupView && window.firebase) {
      const db = window.firebase.database();
      db.ref('users').on('value', (snapshot: any) => {
        setAllUsersData(snapshot.val());
      });
      
      // Listen for shared watchlist
      db.ref('sharedWatchlist').on('value', (snapshot: any) => {
        const data = snapshot.val();
        if (data) {
          setSharedWatchlist(Object.values(data));
        } else {
          setSharedWatchlist([]);
        }
      });
    }
    return () => {
      if (window.firebase) {
        window.firebase.database().ref('users').off();
        window.firebase.database().ref('sharedWatchlist').off();
      }
    };
  }, [isGroupView]);

  const handleSuggestSharedWatchlist = (entry: Entry) => {
    if (!username || !window.firebase) return;
    const db = window.firebase.database();
    const sharedRef = db.ref(`sharedWatchlist/${entry.id}`);
    
    sharedRef.once('value', (snapshot: any) => {
      const existing = snapshot.val();
      let suggestedBy = [username];
      
      if (existing && existing.suggestedBy) {
        if (existing.suggestedBy.includes(username)) {
          setToast("Bereits vorgeschlagen");
          setTimeout(() => setToast(null), 2000);
          return;
        }
        suggestedBy = [...existing.suggestedBy, username];
      }
      
      const sharedEntry = {
        id: entry.id,
        title: entry.title,
        year: entry.year,
        type: entry.type,
        poster: entry.poster,
        imdbRating: entry.imdbRating,
        plot: entry.plot,
        genre: entry.genre,
        suggestedBy
      };
      
      sharedRef.set(sharedEntry);
      setToast("Vorschlag gesendet");
      setTimeout(() => setToast(null), 2000);
    });
  };

  const handleRemoveFromSharedWatchlist = (imdbID: string) => {
    if (!window.firebase) return;
    window.firebase.database().ref(`sharedWatchlist/${imdbID}`).remove();
  };

  const handleCopyFromSharedToPersonal = (entry: any) => {
    if (!username || !window.firebase) return;
    
    const isAlreadyInWatchlist = watchlist.some(e => e.id === entry.id);
    const isAlreadyInRated = entries.some(e => e.id === entry.id);
    
    if (isAlreadyInWatchlist || isAlreadyInRated) {
      setToast("Bereits in deiner Liste");
      setTimeout(() => setToast(null), 2000);
      return;
    }

    const newEntry: Entry = {
      id: entry.id,
      title: entry.title,
      year: entry.year,
      type: entry.type,
      poster: entry.poster,
      imdbRating: entry.imdbRating,
      plot: entry.plot,
      genre: entry.genre,
      imdbUrl: `https://www.imdb.com/title/${entry.id}/`,
      addedAt: Date.now()
    };

    const newWatchlist = [newEntry, ...watchlist];
    setWatchlist(newWatchlist);
    syncToFirebase(entries, newWatchlist);
    setToast("Zur Watchlist hinzugefügt");
    setTimeout(() => setToast(null), 2000);
  };

  const handleFetchRandomMovie = async () => {
    setIsRandomLoading(true);
    setError(null);
    
    const topRatedIds = [
      'tt0111161', 'tt0068646', 'tt0071562', 'tt0468569', 'tt0050083', 'tt0108052', 'tt0167260',
      'tt0110912', 'tt0060196', 'tt0120737', 'tt0109830', 'tt0137523', 'tt0080684', 'tt0133093',
      'tt0099685', 'tt0073486', 'tt0047478', 'tt0114369', 'tt0317248', 'tt0076759', 'tt0102926',
      'tt0816692', 'tt0245429', 'tt0120689', 'tt0118799', 'tt0120815', 'tt0482571', 'tt1375666',
      'tt0407887', 'tt0172495', 'tt0114814', 'tt0056058', 'tt0034583', 'tt0021749', 'tt0022100',
      'tt0364569', 'tt0338013', 'tt0167261', 'tt0361748', 'tt0253474', 'tt0209144', 'tt0078788',
      'tt0078748', 'tt0057012', 'tt0435761', 'tt0910970', 'tt0095765', 'tt0086879', 'tt0093058',
      'tt0119488', 'tt0119217', 'tt0105236', 'tt0052357', 'tt0071853', 'tt0112573', 'tt0070608',
      'tt0082971', 'tt0088763', 'tt0091251', 'tt0092099', 'tt0102603', 'tt0103064', 'tt0107290',
      'tt0110357', 'tt0110413', 'tt0113277', 'tt0114709', 'tt0120338', 'tt0120738', 'tt0139134',
      'tt0145487', 'tt0167262', 'tt0203009', 'tt0204946', 'tt0208092', 'tt0232500', 'tt0234215',
      'tt0241527', 'tt0242653', 'tt0266697', 'tt0268978', 'tt0311519', 'tt0330373', 'tt0335266',
      'tt0347198', 'tt0353969', 'tt0371746', 'tt0372784', 'tt0382816', 'tt0405059', 'tt0418279',
      'tt0440963', 'tt0451279', 'tt0470752', 'tt0770828', 'tt0848228', 'tt0945513', 'tt0993846',
      'tt1130884', 'tt1132620', 'tt1205489', 'tt1675434', 'tt1892124', 'tt2017020', 'tt2096673',
      'tt2380307', 'tt3011894', 'tt3501632', 'tt4154756', 'tt4154796', 'tt5311514', 'tt6751668',
      'tt7286456', 'tt8579674'
    ];

    const maxRetries = 3;
    let currentRetry = 0;
    const apiKey = '442d43ab';

    while (currentRetry <= maxRetries) {
      const randomId = topRatedIds[Math.floor(Math.random() * topRatedIds.length)];
      
      try {
        const response = await fetch(`https://www.omdbapi.com/?i=${randomId}&apikey=${apiKey}`);
        const movie = await response.json();
        
        if (movie.Response === "True") {
          setTempEntry({
            id: movie.imdbID,
            title: movie.Title,
            year: movie.Year,
            type: movie.Type === 'series' ? 'series' : 'movie',
            poster: movie.Poster !== 'N/A' ? movie.Poster : PLACEHOLDER_IMAGE,
            imdbRating: movie.imdbRating,
            plot: movie.Plot,
            genre: movie.Genre,
            actors: movie.Actors,
            runtime: movie.Runtime,
            imdbUrl: `https://www.imdb.com/title/${movie.imdbID}/`,
            addedAt: Date.now()
          });
          setIsRandomLoading(false);
          return;
        }
      } catch (err) {
        console.error("Random fetch error:", err);
      }
      currentRetry++;
    }
    
    setError("Fehler beim Laden. Bitte erneut versuchen.");
    setIsRandomLoading(false);
  };

  const handleWelcomeSubmit = () => {
    if (welcomeInput.trim()) {
      const name = welcomeInput.trim().toLowerCase();
      localStorage.setItem('cinerank_username', name);
      setUsername(name);
      setIsWelcomeOpen(false);
    }
  };

  // New Entry Form State
  const [tempEntry, setTempEntry] = useState<Partial<Entry> | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier>('B');
  const [selectedRating, setSelectedRating] = useState(7);

  // Load data
  useEffect(() => {
    const savedEntries = localStorage.getItem('cinerank_entries');
    if (savedEntries) {
      try {
        let parsed = JSON.parse(savedEntries);
        // Migration: 1-5 to 0-10
        const migrated = parsed.map((e: any) => {
          if (e.rating !== undefined && e.rating <= 5 && !e.migrated) {
            return { ...e, rating: e.rating * 2, migrated: true };
          }
          return e;
        });
        setEntries(migrated);
      } catch (e) {
        console.error("Failed to parse entries", e);
      }
    }

    const savedWatchlist = localStorage.getItem('cinerank_watchlist');
    if (savedWatchlist) {
      try {
        setWatchlist(JSON.parse(savedWatchlist));
      } catch (e) {
        console.error("Failed to parse watchlist", e);
      }
    }
    
    const savedTab = localStorage.getItem('cinerank_active_tab');
    if (savedTab === 'movie' || savedTab === 'series' || savedTab === 'watchlist') {
      setActiveTab(savedTab as EntryType);
    }

    const savedKey = localStorage.getItem('cinerank_api_key');
    if (savedKey) {
      setCustomApiKey(savedKey);
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem('cinerank_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('cinerank_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('cinerank_active_tab', activeTab);
  }, [activeTab]);

  const saveApiKey = (key: string) => {
    setCustomApiKey(key);
    localStorage.setItem('cinerank_api_key', key);
    setIsSettingsOpen(false);
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (activeTab === 'watchlist') return watchlist;
    return entries.filter(e => e.type === activeTab);
  }, [entries, watchlist, activeTab]);

  // Extract IMDB ID
  const extractImdbId = (url: string) => {
    const match = url.match(/tt\d+/);
    return match ? match[0] : null;
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (imdbInput.startsWith('http')) {
        handleFetchMovie(imdbInput);
      } else if (imdbInput.length >= 3) {
        handleSearch(imdbInput);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [imdbInput]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setError(null);
    const apiKey = customApiKey || DEFAULT_OMDB_API_KEY;

    try {
      const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${apiKey}`);
      const data = await response.json();

      if (data.Response === "True") {
        // Filter out duplicates based on imdbID to prevent key collisions
        const uniqueResults = (data.Search || []).filter((item: any, index: number, self: any[]) =>
          index === self.findIndex((t: any) => t.imdbID === item.imdbID)
        );
        setSearchResults(uniqueResults);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        if (data.Error !== "Movie not found!") {
          setError(data.Error);
        } else {
          setShowDropdown(true); // Show "No results"
        }
      }
    } catch (err) {
      setError("Netzwerkfehler bei der Suche.");
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch from OMDB
  const handleFetchMovie = async (idOrUrl?: string) => {
    const target = idOrUrl || imdbInput;
    let id = target.startsWith('tt') ? target : extractImdbId(target);
    
    if (!id) {
      if (target.startsWith('http')) {
        setError("Ungültiger IMDB Link. Bitte kopiere einen Link wie: https://www.imdb.com/title/tt0468569/");
        return;
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowDropdown(false);

    const apiKey = customApiKey || DEFAULT_OMDB_API_KEY;

    try {
      const response = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${apiKey}&plot=short`);
      const data = await response.json();

      if (data.Response === "True") {
        const posterUrl = data.Poster !== "N/A" ? data.Poster : PLACEHOLDER_IMAGE;
        setTempEntry({
          id: data.imdbID,
          title: data.Title,
          year: data.Year,
          type: data.Type === 'series' ? 'series' : 'movie',
          poster: getHighResPoster(posterUrl),
          imdbUrl: `https://www.imdb.com/title/${data.imdbID}/`,
          imdbRating: data.imdbRating !== "N/A" ? data.imdbRating : "–",
          plot: data.Plot !== "N/A" ? data.Plot : "Keine Handlung verfügbar.",
          genre: data.Genre !== "N/A" ? data.Genre : "–",
          actors: data.Actors !== "N/A" ? data.Actors : "–",
          runtime: data.Runtime !== "N/A" ? data.Runtime : "–",
        });
        setImdbInput('');
      } else {
        if (data.Error === "Invalid API key!") {
          setError("Der API-Schlüssel ist ungültig oder abgelaufen. Bitte gib einen eigenen Key in den Einstellungen ein.");
        } else {
          setError(data.Error || "Film konnte nicht gefunden werden.");
        }
      }
    } catch (err) {
      setError("Netzwerkfehler beim Abrufen der Daten.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save Entry
  const handleSaveEntry = (toWatchlist: boolean = false) => {
    if (!tempEntry) return;

    const newEntry: Entry = {
      ...(tempEntry as any),
      tier: toWatchlist ? undefined : selectedTier,
      rating: toWatchlist ? undefined : selectedRating,
      addedAt: Date.now(),
    };

    if (toWatchlist) {
      let updatedWatchlist;
      if (watchlist.find(e => e.id === newEntry.id)) {
        updatedWatchlist = watchlist.map(e => e.id === newEntry.id ? newEntry : e);
      } else {
        updatedWatchlist = [newEntry, ...watchlist];
      }
      setWatchlist(updatedWatchlist);
      syncToFirebase(entries, updatedWatchlist);
      
      // Success Toast
      setToast("Zur Watchlist hinzugefügt");
      setTimeout(() => setToast(null), 2000);
    } else {
      const updatedWatchlist = watchlist.filter(e => e.id !== newEntry.id);
      setWatchlist(updatedWatchlist);
      
      let updatedEntries;
      if (entries.find(e => e.id === newEntry.id)) {
        updatedEntries = entries.map(e => e.id === newEntry.id ? newEntry : e);
      } else {
        updatedEntries = [newEntry, ...entries];
      }
      setEntries(updatedEntries);
      syncToFirebase(updatedEntries, updatedWatchlist);
    }

    // Reset
    setTempEntry(null);
    setImdbInput('');
    setIsAddingMode(false);
  };

  const handleDeleteEntry = (id: string, fromWatchlist: boolean = false) => {
    if (window.confirm("Möchtest du diesen Eintrag wirklich löschen?")) {
      let updatedEntries = entries;
      let updatedWatchlist = watchlist;

      if (fromWatchlist) {
        updatedWatchlist = watchlist.filter(e => e.id !== id);
        setWatchlist(updatedWatchlist);
      } else {
        updatedEntries = entries.filter(e => e.id !== id);
        setEntries(updatedEntries);
      }
      syncToFirebase(updatedEntries, updatedWatchlist);
      setSelectedEntry(null);
    }
  };

  const handleMoveToRated = (entry: Entry) => {
    setTempEntry({
      id: entry.id,
      title: entry.title,
      year: entry.year,
      type: entry.type,
      poster: entry.poster,
      imdbUrl: entry.imdbUrl,
      imdbRating: entry.imdbRating,
      plot: entry.plot,
      genre: entry.genre,
      actors: entry.actors,
      runtime: entry.runtime,
    });
    setSelectedTier('B');
    setSelectedRating(7);
    setIsAddingMode(true);
  };

  const handleEditEntry = (entry: Entry) => {
    setSelectedEntry(null);
    setTempEntry({
      id: entry.id,
      title: entry.title,
      year: entry.year,
      type: entry.type,
      poster: entry.poster,
      imdbUrl: entry.imdbUrl,
      imdbRating: entry.imdbRating,
      plot: entry.plot,
      genre: entry.genre,
      actors: entry.actors,
      runtime: entry.runtime,
    });
    setSelectedTier(entry.tier || 'B');
    setSelectedRating(entry.rating || 7);
    setIsAddingMode(true);
  };

  return (
    <div className="min-h-screen bg-neutral-bg text-neutral-100 font-sans selection:bg-primary/30">
      {/* Background Mesh */}
      <div className="bg-mesh" />

      {/* Header */}
      <header className="sticky top-0 z-40 glass-dark border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="flex items-center gap-4 group cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative w-16 sm:w-20 h-10 flex items-center justify-center">
              <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full opacity-20 fill-white">
                <text x="0" y="40" className="text-4xl font-black font-display">S</text>
                <text x="75" y="40" className="text-4xl font-black font-display">E</text>
              </svg>
              <div className="relative z-10 text-[8px] sm:text-[10px] font-display font-black tracking-[0.3em] sm:tracking-[0.5em] text-white pt-1">SCENEIT</div>
            </div>
          </motion.div>

          <div className="hidden lg:flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => {
                setActiveTab('movie');
                setIsGroupView(false);
              }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${
                activeTab === 'movie' && !isGroupView ? 'bg-white/10 text-white shadow-2xl' : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              Filme
            </button>
            <button
              onClick={() => {
                setActiveTab('series');
                setIsGroupView(false);
              }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${
                activeTab === 'series' && !isGroupView ? 'bg-white/10 text-white shadow-2xl' : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              Serien
            </button>
            <button
              onClick={() => {
                setActiveTab('watchlist');
                setIsGroupView(false);
              }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${
                activeTab === 'watchlist' && !isGroupView ? 'bg-white/10 text-white shadow-2xl' : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              Watchlist
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setIsGroupView(!isGroupView)}
              className={`hidden lg:block p-3 rounded-2xl transition-all duration-300 ${
                isGroupView ? 'bg-white text-neutral-bg' : 'text-neutral-600 hover:text-white hover:bg-white/5'
              }`}
              title="Gruppen Übersicht"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 text-neutral-600 hover:text-white hover:bg-white/5 rounded-2xl transition-all duration-300"
              title="Einstellungen"
            >
              <Settings className="w-5 h-5" />
            </button>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(255,255,255,0.1)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsAddingMode(true)}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white hover:bg-neutral-200 text-neutral-bg font-black rounded-xl sm:rounded-2xl flex items-center gap-2 transition-all shadow-2xl shadow-white/10"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden md:inline text-xs uppercase tracking-widest">Hinzufügen</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-10 pb-32 lg:pb-10">
        {isOffline && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-center gap-3 py-3 px-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-black uppercase tracking-widest"
          >
            <WifiOff className="w-4 h-4" />
            Keine Verbindung zum Server — Änderungen werden lokal zwischengespeichert
          </motion.div>
        )}

        {isGroupView ? (
          <GroupView 
            allUsersData={allUsersData} 
            currentUsername={username || ''} 
            onSelectEntry={setSelectedEntry}
            sharedWatchlist={sharedWatchlist}
            onRemoveFromShared={handleRemoveFromSharedWatchlist}
            onCopyToPersonal={handleCopyFromSharedToPersonal}
          />
        ) : (
          <>
            {/* View Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-16">
          {activeTab !== 'watchlist' ? (
            <div className="flex gap-10">
              <button
                onClick={() => setViewMode('tier')}
                className={`text-xs font-black uppercase tracking-[0.3em] pb-3 border-b-2 transition-all duration-500 ${
                  viewMode === 'tier' ? 'border-white text-white' : 'border-transparent text-neutral-700 hover:text-neutral-400'
                }`}
              >
                Tier List
              </button>
              <button
                onClick={() => setViewMode('rating')}
                className={`text-xs font-black uppercase tracking-[0.3em] pb-3 border-b-2 transition-all duration-500 ${
                  viewMode === 'rating' ? 'border-white text-white' : 'border-transparent text-neutral-700 hover:text-neutral-400'
                }`}
              >
                Bewertung
              </button>
            </div>
          ) : (
            <div className="text-xs font-black uppercase tracking-[0.3em] pb-3 border-b-2 border-white text-white">
              Watchlist
            </div>
          )}
          <div className="px-5 py-2 bg-white/5 rounded-full border border-white/5 text-neutral-600 text-[10px] font-black uppercase tracking-widest">
            {activeTab === 'watchlist' ? watchlist.length : filteredEntries.length} {
              activeTab === 'watchlist' ? 'Einträge' : (activeTab === 'movie' ? 'Filme' : 'Serien')
            }
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {filteredEntries.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-32 text-center"
            >
              <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 border border-white/5">
                <Search className="w-10 h-10 text-neutral-800" />
              </div>
              <h2 className="text-2xl font-display font-bold text-neutral-400">Deine Liste ist leer</h2>
              <p className="text-neutral-600 mt-3 max-w-xs text-sm leading-relaxed">
                {activeTab === 'watchlist' 
                  ? 'Füge Filme oder Serien zu deiner Watchlist hinzu, um sie später zu ranken.' 
                  : `Fange an, deine Lieblings-${activeTab === 'movie' ? 'Filme' : 'Serien'} zu ranken.`}
              </p>
              <button
                onClick={() => setIsAddingMode(true)}
                className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
              >
                Jetzt starten
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {activeTab === 'watchlist' ? (
                <motion.div 
                  key="watchlist"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-8"
                >
                  {watchlist.map(entry => (
                    <div key={entry.id} className="w-full">
                      <MovieCard 
                        entry={entry} 
                        onClick={() => setSelectedEntry(entry)} 
                        onMoveToRated={() => handleMoveToRated(entry)}
                        onDelete={() => handleDeleteEntry(entry.id, true)}
                        onSuggestShared={() => handleSuggestSharedWatchlist(entry)}
                      />
                    </div>
                  ))}
                </motion.div>
              ) : viewMode === 'tier' ? (
                TIERS.map((tier, idx) => {
                  const tierEntries = filteredEntries.filter(e => e.tier === tier);
                  return (
                    <motion.div 
                      key={tier} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex flex-col sm:flex-row gap-4 sm:gap-8 py-6 sm:py-8 border-b border-white/5 last:border-0 group"
                    >
                      <div className="flex items-center gap-4 sm:flex-col sm:justify-center sm:w-20 shrink-0">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border-2 flex items-center justify-center text-lg sm:text-xl font-display font-black ${TIER_COLORS[tier]} transition-all duration-500 group-hover:scale-110`}>
                          {tier}
                        </div>
                        <div className={`hidden sm:block w-1 h-12 rounded-full bg-gradient-to-b ${TIER_COLORS[tier].split(' ')[1].replace('border-', 'from-')} to-transparent opacity-20`} />
                      </div>
                      <motion.div 
                        className="flex-1 flex sm:flex-wrap gap-4 sm:gap-5 min-h-[120px] sm:min-h-[160px] items-center overflow-x-auto sm:overflow-x-visible pb-4 sm:pb-0 scrollbar-hide"
                        variants={{
                          hidden: { opacity: 0 },
                          show: {
                            opacity: 1,
                            transition: {
                              staggerChildren: 0.05
                            }
                          }
                        }}
                        initial="hidden"
                        animate="show"
                      >
                        {tierEntries.map(entry => (
                          <div key={entry.id} className="shrink-0 sm:shrink">
                            <MovieCard entry={entry} onClick={() => setSelectedEntry(entry)} />
                          </div>
                        ))}
                        {tierEntries.length === 0 && (
                          <div className="flex items-center justify-center w-full text-neutral-800 text-[10px] font-black uppercase tracking-[0.3em] italic opacity-30">
                            Keine Einträge
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  );
                })
              ) : (
                RATINGS.map((rating, idx) => {
                  const ratingEntries = filteredEntries.filter(e => e.rating === rating);
                  return (
                    <motion.div 
                      key={rating} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-4 px-2 sm:px-4">
                        <div className="hidden sm:flex gap-1">
                          {[...Array(10)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-4 h-4 transition-colors ${i < rating ? (rating === 10 ? 'fill-gold-shimmer text-gold-shimmer' : 'fill-white text-white') : 'text-neutral-800'}`} 
                            />
                          ))}
                        </div>
                        <div className="sm:hidden flex items-center gap-1">
                          <Star className={`w-4 h-4 ${rating === 10 ? 'fill-gold-shimmer text-gold-shimmer' : 'fill-white text-white'}`} />
                          <span className={`text-lg font-display font-black ${rating === 10 ? 'shimmer-gold' : 'text-white'}`}>{rating.toFixed(1)}</span>
                        </div>
                        <span className={`hidden sm:inline text-xl font-display font-black ${rating === 10 ? 'shimmer-gold' : 'text-white'}`}>{rating.toFixed(1)}</span>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                      <motion.div 
                        className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4 sm:gap-5 min-h-[120px] sm:min-h-[160px] items-center"
                        variants={{
                          hidden: { opacity: 0 },
                          show: {
                            opacity: 1,
                            transition: {
                              staggerChildren: 0.05
                            }
                          }
                        }}
                        initial="hidden"
                        animate="show"
                      >
                        {ratingEntries.map(entry => (
                          <div key={entry.id} className="w-full sm:w-auto">
                            <MovieCard entry={entry} onClick={() => setSelectedEntry(entry)} />
                          </div>
                        ))}
                        {ratingEntries.length === 0 && (
                          <div className="flex items-center justify-center w-full text-neutral-800 text-[10px] font-black uppercase tracking-[0.3em] italic opacity-30">
                            Keine Einträge
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )}
  </main>

      {/* Welcome Overlay */}
      <AnimatePresence>
        {isWelcomeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-bg"
          >
            <div className="bg-mesh opacity-50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative z-10 max-w-md w-full text-center"
            >
              <div className="relative w-32 h-16 mx-auto mb-12 flex items-center justify-center">
                <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full opacity-20 fill-white">
                  <text x="0" y="40" className="text-4xl font-black font-display">S</text>
                  <text x="75" y="40" className="text-4xl font-black font-display">E</text>
                </svg>
                <div className="relative z-10 text-[12px] font-display font-black tracking-[0.5em] text-white pt-1">SCENEIT</div>
              </div>

              <h2 className="text-3xl font-display font-black text-white mb-4">Willkommen</h2>
              <p className="text-neutral-500 text-sm mb-10 tracking-widest uppercase font-bold">Wie heißt du?</p>

              <div className="space-y-4">
                <input
                  type="text"
                  value={welcomeInput}
                  onChange={(e) => setWelcomeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWelcomeSubmit()}
                  placeholder="Dein Name"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-center text-lg font-bold"
                  autoFocus
                />
                <button
                  onClick={handleWelcomeSubmit}
                  disabled={!welcomeInput.trim()}
                  className="w-full py-5 bg-white hover:bg-neutral-200 disabled:opacity-50 text-neutral-bg font-black rounded-2xl transition-all shadow-2xl shadow-white/10 uppercase tracking-widest text-sm"
                >
                  Loslegen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/20 rounded-xl flex items-center justify-center">
                      <Settings className="w-5 h-5 text-secondary" />
                    </div>
                    <h2 className="text-2xl font-display font-bold">Einstellungen</h2>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      OMDB API Key
                    </label>
                    <input
                      type="text"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder="Dein API Key (z.B. 442d43ab)"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm"
                    />
                    <p className="text-[11px] text-neutral-600 mt-4 leading-relaxed">
                      Du kannst einen kostenlosen Key auf <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener noreferrer" className="text-white hover:underline font-bold">omdbapi.com</a> anfordern.
                    </p>
                  </div>

                  <button
                    onClick={() => saveApiKey(customApiKey)}
                    className="w-full py-4 bg-white hover:bg-neutral-200 text-neutral-bg font-black rounded-2xl transition-all shadow-lg shadow-white/5"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddingMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingMode(false);
                setTempEntry(null);
                setError(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md hidden sm:block"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full h-full sm:h-auto sm:max-w-lg glass sm:rounded-[2.5rem] shadow-2xl overflow-y-auto"
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl sm:text-2xl font-display font-bold">Hinzufügen</h2>
                  <button 
                    onClick={() => {
                      setIsAddingMode(false);
                      setTempEntry(null);
                      setError(null);
                    }}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!tempEntry ? (
                  <div className="space-y-6">
                    <div ref={searchRef} className="relative">
                      <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-3">Titel suchen oder IMDB Link</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={imdbInput}
                          onChange={(e) => setImdbInput(e.target.value)}
                          onFocus={() => imdbInput.length >= 3 && !imdbInput.startsWith('http') && setShowDropdown(true)}
                          placeholder="z.B. The Dark Knight"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {isSearching || isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                          ) : (
                            <Search className="w-5 h-5 text-neutral-500" />
                          )}
                        </div>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.01, filter: 'brightness(1.2)' }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleFetchRandomMovie}
                        disabled={isRandomLoading}
                        className="w-full h-[52px] mt-4 mb-4 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md border border-white/10 rounded-[12px] flex items-center justify-center px-6 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)] disabled:cursor-not-allowed group"
                      >
                        <div className="flex items-center justify-center w-full relative">
                          <div className="absolute left-0">
                            {isRandomLoading ? (
                              <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                            ) : (
                              <Dice5 className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
                            )}
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90 group-hover:text-white transition-colors">
                            {isRandomLoading ? 'Suche...' : 'Zufälliger Top-Film'}
                          </span>
                        </div>
                      </motion.button>

                      {error && (
                        <p className="text-[10px] text-white/40 font-bold text-center -mt-2 mb-4 uppercase tracking-widest">
                          {error}
                        </p>
                      )}

                      {/* Search Dropdown */}
                      <AnimatePresence>
                        {showDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white/[0.05] backdrop-blur-[20px] border border-white/[0.08] rounded-[14px] overflow-hidden z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[50vh] sm:max-h-[380px] overflow-y-auto scrollbar-custom"
                          >
                            {searchResults.length > 0 ? (
                              searchResults.map((result) => (
                                <button
                                  key={result.imdbID}
                                  onClick={() => handleFetchMovie(result.imdbID)}
                                  className="w-full h-[72px] px-4 flex items-center gap-[14px] hover:bg-white/[0.07] transition-all duration-150 text-left border-b border-white/[0.06] last:border-0 group/item"
                                >
                                  <SearchPoster 
                                    src={result.Poster} 
                                    alt={result.Title} 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[15px] font-medium text-white truncate tracking-normal normal-case">{result.Title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-neutral-400 font-medium">
                                        {result.Year}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-neutral-400 font-medium">
                                        {result.Type === 'series' ? 'Serie' : 'Film'}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="p-10 text-center">
                                <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-500">Keine Ergebnisse gefunden</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {!imdbInput && (
                      <div className="text-[11px] text-neutral-600 bg-white/5 p-4 rounded-2xl border border-white/5">
                        Tipp: Kopiere einfach die URL der Detailseite von IMDB.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex gap-4 sm:gap-6">
                      <div className="relative shrink-0">
                        <img 
                          src={tempEntry.poster} 
                          alt={tempEntry.title} 
                          className="w-20 h-30 sm:w-24 sm:h-36 object-cover rounded-xl sm:rounded-2xl shadow-2xl border border-white/10"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute -bottom-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center text-neutral-bg font-black text-xs shadow-lg">
                          {selectedTier}
                        </div>
                      </div>
                      <div className="flex-1 pt-1 sm:pt-2">
                        <h3 className="text-lg sm:text-xl font-display font-black leading-tight bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">
                          {tempEntry.title}
                        </h3>
                        <p className="text-neutral-500 text-xs sm:text-sm mt-1 sm:mt-2 font-bold">{tempEntry.year} • {tempEntry.type === 'movie' ? 'Film' : 'Serie'}</p>
                        <button 
                          onClick={() => setTempEntry(null)}
                          className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:brightness-110 mt-4 sm:mt-6 transition-all flex items-center gap-2"
                        >
                          <Edit2 className="w-3 h-3" />
                          Ändern
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-4">Tier auswählen</label>
                        <div className="flex flex-wrap gap-2">
                          {TIERS.map(tier => (
                            <button
                              key={tier}
                              onClick={() => setSelectedTier(tier)}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl font-display font-black transition-all duration-300 border-2 ${
                                selectedTier === tier 
                                  ? `${TIER_COLORS[tier]} scale-110 shadow-xl` 
                                  : 'bg-white/5 text-neutral-600 border-transparent hover:bg-white/10'
                              }`}
                            >
                              {tier}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-xs font-black uppercase tracking-widest text-neutral-500">Bewertung</label>
                          <span className="text-lg sm:text-xl font-display font-black text-white">{selectedRating.toFixed(1)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                            <button
                              key={star}
                              onClick={() => setSelectedRating(star)}
                              className="transition-transform hover:scale-125 active:scale-95"
                            >
                              <Star 
                                className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-300 ${
                                  star <= selectedRating ? (selectedRating === 10 ? 'fill-gold-shimmer text-gold-shimmer' : 'fill-white text-white') : 'text-neutral-800'
                                }`} 
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4">
                      <button
                        onClick={() => handleSaveEntry(false)}
                        className={`py-4 font-black rounded-2xl transition-all shadow-xl active:scale-[0.98] text-xs uppercase tracking-widest order-1 sm:order-none ${
                          selectedRating === 10 
                            ? 'bg-gold-shimmer text-neutral-bg shadow-gold/20' 
                            : 'bg-white text-neutral-bg shadow-white/5'
                        }`}
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => handleSaveEntry(true)}
                        className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-2xl transition-all shadow-xl active:scale-[0.98] text-xs uppercase tracking-widest order-2 sm:order-none"
                      >
                        Watchlist
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEntry(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl min-h-[600px] sm:min-h-[600px] max-h-[90vh] bg-[#0a0a0a] rounded-2xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/5 flex flex-col md:flex-row"
            >
              {/* Blurred Background Depth */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none blur-3xl scale-110"
                style={{ 
                  backgroundImage: `url(${getHighResPoster(selectedEntry.poster)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />

              {/* Left Half: Poster */}
              <div className="w-full md:w-2/5 h-[240px] md:h-auto relative z-10">
                <img 
                  src={getHighResPoster(selectedEntry.poster)} 
                  alt={selectedEntry.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Right Half: Content */}
              <div className="w-full md:w-3/5 relative z-10 flex flex-col p-6 sm:p-8 md:p-10 bg-black/20 backdrop-blur-xl overflow-y-auto">
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-neutral-500 hover:text-white transition-colors z-20"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex-1 flex flex-col justify-center py-4">
                  <div className="mb-4">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold leading-tight mb-2 line-clamp-2 text-white">
                      {selectedEntry.title}
                    </h2>
                    <div className="flex items-center gap-2 text-neutral-500 text-[10px] sm:text-[11px] font-medium tracking-wider">
                      <span>{selectedEntry.year}</span>
                      <span className="w-1 h-1 rounded-full bg-neutral-700" />
                      <span>{selectedEntry.runtime}</span>
                    </div>
                  </div>

                  {selectedEntry.genre && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {selectedEntry.genre.split(', ').map(g => (
                        <span key={g} className="px-2.5 py-0.5 border border-white/10 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-neutral-600 font-bold mb-2">Handlung</h4>
                      <div className="relative">
                        <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed line-clamp-3 sm:line-clamp-none">
                          {selectedEntry.plot}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-neutral-600 font-bold mb-2">Besetzung</h4>
                      <p className="text-[10px] sm:text-[11px] text-neutral-500 truncate">
                        {selectedEntry.actors}
                      </p>
                    </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex items-center gap-6 md:gap-8 mb-8">
                    {selectedEntry.tier && (
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] uppercase tracking-[0.2em] text-neutral-600 font-bold mb-2">Tier</span>
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl font-display font-bold border-2 ${TIER_COLORS[selectedEntry.tier]} bg-black/40`}>
                          {selectedEntry.tier}
                        </div>
                      </div>
                    )}
                    {selectedEntry.rating !== undefined && (
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] uppercase tracking-[0.2em] text-neutral-600 font-bold mb-2">Bewertung</span>
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-sm sm:text-base font-display font-bold border-2 ${
                          selectedEntry.rating === 10 
                            ? 'border-gold bg-gold-shimmer/20 text-white' 
                            : 'border-neutral-800 text-neutral-400 bg-neutral-900/30'
                        }`}>
                          <span className={selectedEntry.rating === 10 ? 'shimmer-gold' : ''}>
                            {(selectedEntry.rating || 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )}
                    {selectedEntry.imdbRating && (
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] uppercase tracking-[0.2em] text-neutral-600 font-bold mb-2">IMDB</span>
                        <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center border-2 border-amber-400/30 bg-amber-400/5">
                          <Star className="w-2 sm:w-2.5 h-2 sm:h-2.5 fill-amber-400 text-amber-400 mb-0.5" />
                          <span className="text-[10px] sm:text-[11px] font-display font-bold text-amber-400">{selectedEntry.imdbRating}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <motion.a
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      whileTap={{ scale: 0.99 }}
                      href={selectedEntry.imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 border border-white/10 rounded-xl font-bold uppercase tracking-widest text-[8px] sm:text-[9px] text-neutral-400 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Auf IMDB öffnen
                    </motion.a>
                    
                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                      {!selectedEntry.tier ? (
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => {
                            setSelectedEntry(null);
                            handleMoveToRated(selectedEntry);
                          }}
                          className="flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-[8px] sm:text-[9px] transition-all"
                        >
                          <Star className="w-3.5 h-3.5 fill-black" />
                          Gesehen — Bewerten
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.05)' }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleEditEntry(selectedEntry)}
                          className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl font-bold uppercase tracking-widest text-[8px] sm:text-[9px] text-neutral-400 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Bearbeiten
                        </motion.button>
                      )}
                      
                      <motion.button
                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleDeleteEntry(selectedEntry.id, !selectedEntry.tier)}
                        className="flex items-center justify-center gap-2 py-3 bg-red-500/5 border border-red-500/10 text-red-500/70 rounded-xl font-bold uppercase tracking-widest text-[8px] sm:text-[9px] transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Löschen
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Bottom Navigation (Mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-bg/80 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => {
            setActiveTab('movie');
            setIsGroupView(false);
          }}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            activeTab === 'movie' && !isGroupView ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Filme</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('series');
            setIsGroupView(false);
          }}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            activeTab === 'series' && !isGroupView ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Serien</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('watchlist');
            setIsGroupView(false);
          }}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            activeTab === 'watchlist' && !isGroupView ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Watchlist</span>
        </button>
        <button
          onClick={() => setIsGroupView(!isGroupView)}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            isGroupView ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Gruppe</span>
        </button>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-white text-neutral-bg font-black rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs uppercase tracking-widest">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GroupView({ 
  allUsersData, 
  currentUsername, 
  onSelectEntry,
  sharedWatchlist,
  onRemoveFromShared,
  onCopyToPersonal
}: { 
  allUsersData: any, 
  currentUsername: string, 
  onSelectEntry: (e: Entry) => void,
  sharedWatchlist: any[],
  onRemoveFromShared: (id: string) => void,
  onCopyToPersonal: (entry: any) => void
}) {
  const [sharedFilter, setSharedFilter] = useState<'all' | 'movie' | 'series'>('all');

  if (!allUsersData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 className="w-10 h-10 text-neutral-800 animate-spin mb-4" />
        <p className="text-neutral-600 text-xs uppercase tracking-widest font-black">Lade Gruppen-Daten...</p>
      </div>
    );
  }

  // Process data
  const movieMap: Record<string, { entry: Entry, ratings: { user: string, score: number }[] }> = {};
  
  Object.entries(allUsersData).forEach(([user, userData]: [string, any]) => {
    if (userData.ratings) {
      Object.values(userData.ratings).forEach((entry: any) => {
        if (!movieMap[entry.id]) {
          movieMap[entry.id] = { entry, ratings: [] };
        }
        movieMap[entry.id].ratings.push({ user, score: entry.rating || 0 });
      });
    }
  });

  const allMovies = Object.values(movieMap).map(m => ({
    ...m,
    avgRating: m.ratings.reduce((acc, r) => acc + r.score, 0) / m.ratings.length
  }));

  const multiRated = allMovies.filter(m => m.ratings.length > 1).sort((a, b) => b.avgRating - a.avgRating);
  const singleRated = allMovies.filter(m => m.ratings.length === 1 && m.ratings[0].user === currentUsername);

  return (
    <div className="space-y-20">
      <section>
        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-neutral-700 mb-10 text-center">Gemeinsame Übersicht</h3>
        {multiRated.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[3rem]">
            <p className="text-neutral-700 text-[10px] font-black uppercase tracking-widest italic opacity-50">Noch keine gemeinsamen Bewertungen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
            {multiRated.map(m => (
              <motion.div 
                key={m.entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-dark rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-6 flex gap-4 sm:gap-6 items-center border border-white/5 hover:border-white/10 transition-all group"
              >
                <div 
                  className="w-20 sm:w-24 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 cursor-pointer"
                  onClick={() => onSelectEntry(m.entry)}
                >
                  <img src={m.entry.poster} alt={m.entry.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <h4 className="text-xs sm:text-sm font-black text-white truncate pr-4 uppercase tracking-tight">{m.entry.title}</h4>
                    <div className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-display font-black ${m.avgRating === 10 ? 'shimmer-gold bg-gold-shimmer/10 border border-gold/20' : 'text-white bg-white/5 border border-white/10'}`}>
                      {m.avgRating.toFixed(1)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {m.ratings.map(r => (
                      <div key={r.user} className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-lg sm:rounded-xl border border-white/5 flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-neutral-500">{r.user}</span>
                        <span className={`text-[9px] sm:text-[10px] font-display font-black ${r.score === 10 ? 'shimmer-gold' : 'text-white'}`}>{r.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {singleRated.length > 0 && (
        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-neutral-700 mb-10 text-center">Nur von dir bewertet</h3>
          <div className="flex flex-wrap gap-6 justify-center">
            {singleRated.map(m => (
              <MovieCard key={m.entry.id} entry={m.entry} onClick={() => onSelectEntry(m.entry)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col items-center mb-10">
          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-neutral-700 mb-6 text-center">Gemeinsame Watchlist</h3>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {(['all', 'movie', 'series'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSharedFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  sharedFilter === f ? 'bg-white text-neutral-bg' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Alle' : f === 'movie' ? 'Filme' : 'Serien'}
              </button>
            ))}
          </div>
        </div>

        {sharedWatchlist.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[3rem]">
            <p className="text-neutral-700 text-[10px] font-black uppercase tracking-widest italic opacity-50">Noch keine Vorschläge</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-6 justify-center">
            {sharedWatchlist
              .filter(item => sharedFilter === 'all' || item.type === sharedFilter)
              .map(item => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -10 }}
                  className="relative group w-20 sm:w-36 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                >
                  <img 
                    src={getHighResPoster(item.poster)} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-bg via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-3 sm:p-4">
                    <p className="text-[9px] sm:text-[10px] font-black leading-tight line-clamp-2 uppercase tracking-tight text-white mb-1">{item.title}</p>
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.suggestedBy?.map((name: string) => (
                        <span key={name} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[7px] font-black uppercase tracking-widest rounded border border-blue-500/20">
                          Von {name}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => onCopyToPersonal(item)}
                        className="w-full py-1.5 bg-white text-neutral-bg text-[7px] sm:text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-neutral-200 transition-all"
                      >
                        Zu meiner Watchlist
                      </button>
                      <button
                        onClick={() => onRemoveFromShared(item.id)}
                        className="w-full py-1.5 bg-red-500/20 text-red-400 text-[7px] sm:text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500/40 transition-all"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface MovieCardProps {
  entry: Entry;
  onClick: () => void;
  onMoveToRated?: () => void;
  onDelete?: () => void;
  onSuggestShared?: () => void;
  key?: string | number;
}

function MovieCard({ entry, onClick, onMoveToRated, onDelete, onSuggestShared }: MovieCardProps) {
  const isWatchlist = !entry.tier;

  return (
    <motion.div
      layout
      variants={{
        hidden: { opacity: 0, scale: 0.8, y: 20 },
        show: { opacity: 1, scale: 1, y: 0 }
      }}
      whileHover={{ 
        scale: 1.1, 
        y: -12, 
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
      }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative group cursor-pointer w-20 sm:w-36 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
    >
      <img 
        src={getHighResPoster(entry.poster)} 
        alt={entry.title} 
        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      
      {/* IMDB Rating Badge */}
      {entry.imdbRating && entry.imdbRating !== "–" && (
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg flex items-center gap-1 border border-white/10 shadow-xl z-10 transition-all group-hover:scale-110">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-[10px] font-black text-white">{entry.imdbRating}</span>
        </div>
      )}

      {/* User Rating Badge */}
      {!isWatchlist && entry.rating !== undefined && (
        <div className={`absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg flex items-center gap-1 border shadow-xl z-10 transition-all group-hover:scale-110 opacity-0 group-hover:opacity-100 ${
          entry.rating === 10 ? 'border-gold' : 'border-white/10'
        }`}>
          <Star className={`w-3 h-3 ${entry.rating === 10 ? 'fill-gold-shimmer text-gold-shimmer' : 'fill-white text-white'}`} />
          <span className={`text-[10px] font-black ${entry.rating === 10 ? 'shimmer-gold' : 'text-white'}`}>{entry.rating.toFixed(1)}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-neutral-bg via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
        <p className="text-[10px] font-black leading-tight line-clamp-2 uppercase tracking-tight text-white drop-shadow-lg mb-1">{entry.title}</p>
        <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">{entry.year}</p>
        
        {isWatchlist && (
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveToRated?.();
              }}
              className="w-full py-2 bg-white text-neutral-bg text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-neutral-200 transition-all"
            >
              Bewerten
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSuggestShared?.();
              }}
              className="w-full py-2 bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500/40 transition-all flex items-center justify-center gap-2 group/suggest"
              title="Gemeinsam gucken vorschlagen"
            >
              <Users className="w-3 h-3" />
              Vorschlagen
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className="w-full py-2 bg-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500/40 transition-all"
            >
              Löschen
            </button>
          </div>
        )}
      </div>

      {!isWatchlist && entry.tier && (
        <div className={`absolute top-3 right-3 w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black border-2 ${TIER_COLORS[entry.tier]} bg-black/40 backdrop-blur-md shadow-2xl scale-0 group-hover:scale-100 transition-all duration-500 ease-out`}>
          {entry.tier}
        </div>
      )}
    </motion.div>
  );
}
