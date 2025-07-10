import React, { useState, useEffect, useRef, useCallback } from 'react';

// Helper function to format dates
const formatDate = (date) => {
  if (!date) return '';
  // Ensure it's a Date object before formatting
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Define constants for initiative height and gap for vertical stacking
const INITIATIVE_HEIGHT = 40; // px
const INITIATIVE_GAP = 8; // px (for mt-2 equivalent)
const MILESTONE_OFFSET_TOP = 20; // px - how far above the initiative bar the milestone is
const RESIZE_HANDLE_WIDTH = 10; // px - width of the draggable resize handle

// Main App Component
const App = () => {
  const [themes, setThemes] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [timePeriods, setTimePeriods] = useState([]);
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [editingPeriodName, setEditingPeriodName] = useState('');

  const [newThemeName, setNewThemeName] = useState('');
  const [newInitiative, setNewInitiative] = useState({
    themeId: '',
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [newMilestone, setNewMilestone] = useState({
    initiativeId: '', // New field to link to an initiative
    date: '',
    description: '',
  });

  const [showAddThemeModal, setShowAddThemeModal] = useState(false);
  const [showAddInitiativeModal, setShowAddInitiativeModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showEditInitiativeModal, setShowEditInitiativeModal] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState(null);
  const [showEditMilestoneModal, setShowEditMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);

  // State for drag and resize operations
  const [dragState, setDragState] = useState(null); // { id, type: 'move'|'resizeLeft'|'resizeRight', initialMouseX, initialStartDate, initialEndDate }
  // Ref to the outermost grid container to get consistent width for timeline calculations
  const roadmapTimePeriodsRef = useRef(null); 

  // Ref to hold the latest versions of mouse move/up handlers to avoid stale closures
  const dragCallbacks = useRef({});

  // Define an array of background colors for themes
  const themeBackgroundColors = [
    'bg-blue-50', 'bg-green-50', 'bg-yellow-50', 'bg-purple-50', 'bg-red-50',
    'bg-indigo-50', 'bg-pink-50', 'bg-teal-50', 'bg-orange-50', 'bg-cyan-50'
  ];

  // Define a corresponding array of darker colors for initiatives
  const initiativeColors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500',
    'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
  ];

  // Function to generate default time periods (current year + next year's quarters)
  const generateDefaultTimePeriods = () => {
    const periods = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year <= currentYear + 1; year++) {
      for (let q = 1; q <= 4; q++) {
        const startDate = new Date(year, (q - 1) * 3, 1);
        const endDate = new Date(year, q * 3, 0); // Last day of the quarter
        periods.push({
          id: `${year}-Q${q}`,
          name: `Q${q} ${year}`,
          startDate: startDate, // Store as Date object in state
          endDate: endDate,     // Store as Date object in state
          order: year * 10 + q,
        });
      }
    }
    return periods.sort((a, b) => a.order - b.order);
  };

  // Load data from Local Storage on initial render
  useEffect(() => {
    try {
      const storedThemes = localStorage.getItem('roadmapThemes');
      if (storedThemes) {
        setThemes(JSON.parse(storedThemes));
      }

      const storedInitiatives = localStorage.getItem('roadmapInitiatives');
      if (storedInitiatives) {
        // Parse dates back to Date objects
        const parsedInitiatives = JSON.parse(storedInitiatives).map(init => ({
          ...init,
          startDate: new Date(init.startDate),
          endDate: new Date(init.endDate),
        }));
        setInitiatives(parsedInitiatives);
      }

      const storedMilestones = localStorage.getItem('roadmapMilestones');
      if (storedMilestones) {
        // Parse dates back to Date objects
        const parsedMilestones = JSON.parse(storedMilestones).map(milestone => ({
          ...milestone,
          date: new Date(milestone.date),
        }));
        setMilestones(parsedMilestones);
      }

      const storedTimePeriods = localStorage.getItem('roadmapTimePeriods');
      if (storedTimePeriods) {
        // Parse dates back to Date objects
        const parsedTimePeriods = JSON.parse(storedTimePeriods).map(period => ({
          ...period,
          startDate: new Date(period.startDate),
          endDate: new Date(period.endDate),
        }));
        setTimePeriods(parsedTimePeriods);
      } else {
        // If no time periods in storage, generate default ones
        const defaultPeriods = generateDefaultTimePeriods();
        setTimePeriods(defaultPeriods);
        // Save default periods to local storage as ISO strings
        localStorage.setItem('roadmapTimePeriods', JSON.stringify(defaultPeriods.map(p => ({
          ...p,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
        }))));
      }

    } catch (error) {
      console.error("Error loading data from local storage:", error);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Save themes to Local Storage whenever themes state changes
  useEffect(() => {
    localStorage.setItem('roadmapThemes', JSON.stringify(themes));
    // Set default theme for new initiative if not already set
    if (themes.length > 0 && !newInitiative.themeId) {
      setNewInitiative(prev => ({ ...prev, themeId: themes[0].id }));
    }
  }, [themes]);

  // Save initiatives to Local Storage whenever initiatives state changes
  useEffect(() => {
    localStorage.setItem('roadmapInitiatives', JSON.stringify(initiatives));
    // Set default initiative for new milestone if not already set
    if (initiatives.length > 0 && !newMilestone.initiativeId) {
      setNewMilestone(prev => ({ ...prev, initiativeId: initiatives[0].id }));
    }
  }, [initiatives]);

  // Save milestones to Local Storage whenever milestones state changes
  useEffect(() => {
    localStorage.setItem('roadmapMilestones', JSON.stringify(milestones));
  }, [milestones]);

  // Save time periods to Local Storage whenever timePeriods state changes
  useEffect(() => {
    // Convert Date objects to ISO strings before saving to localStorage
    const serializableTimePeriods = timePeriods.map(period => ({
      ...period,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
    }));
    localStorage.setItem('roadmapTimePeriods', JSON.stringify(serializableTimePeriods));
  }, [timePeriods]);

  // Add Theme
  const handleAddTheme = () => {
    if (!newThemeName.trim()) return;
    const newId = `theme-${Date.now()}`; // Simple unique ID
    setThemes(prevThemes => {
      const updatedThemes = [...prevThemes, { id: newId, name: newThemeName, order: prevThemes.length }];
      return updatedThemes;
    });
    setNewThemeName('');
    setShowAddThemeModal(false);
  };

  // Update Theme (if needed, though not explicitly requested, good to have a placeholder)
  const handleUpdateTheme = (id, newName) => {
    setThemes(prevThemes =>
      prevThemes.map(theme =>
        theme.id === id ? { ...theme, name: newName } : theme
      )
    );
  };

  // Delete Theme
  const handleDeleteTheme = (id) => {
    setThemes(prevThemes => prevThemes.filter(theme => theme.id !== id));
    // Also delete all initiatives associated with this theme
    const initiativesToDelete = initiatives.filter(init => init.themeId === id);
    const initiativeIdsToDelete = initiativesToDelete.map(init => init.id);
    setInitiatives(prevInitiatives => prevInitiatives.filter(init => init.themeId !== id));
    // And delete all milestones associated with those initiatives
    setMilestones(prevMilestones => prevMilestones.filter(m => !initiativeIdsToDelete.includes(m.initiativeId)));
  };

  // Add Initiative
  const handleAddInitiative = () => {
    if (!newInitiative.name.trim() || !newInitiative.themeId) return;
    const newId = `initiative-${Date.now()}`; // Simple unique ID
    setInitiatives(prevInitiatives => [
      ...prevInitiatives,
      {
        id: newId,
        themeId: newInitiative.themeId,
        name: newInitiative.name,
        description: newInitiative.description,
        startDate: new Date(newInitiative.startDate),
        endDate: new Date(newInitiative.endDate),
      },
    ]);
    setNewInitiative({
      themeId: themes.length > 0 ? themes[0].id : '',
      name: '',
      description: '',
      startDate: '',
      endDate: '',
    });
    setShowAddInitiativeModal(false);
  };

  // Update Initiative
  const handleUpdateInitiative = () => {
    if (!editingInitiative) return;
    setInitiatives(prevInitiatives =>
      prevInitiatives.map(init =>
        init.id === editingInitiative.id
          ? {
              ...init,
              themeId: editingInitiative.themeId,
              name: editingInitiative.name,
              description: editingInitiative.description,
              startDate: new Date(editingInitiative.startDate),
              endDate: new Date(editingInitiative.endDate),
            }
          : init
      )
    );
    setShowEditInitiativeModal(false);
    setEditingInitiative(null);
  };

  // Delete Initiative
  const handleDeleteInitiative = (id) => {
    setInitiatives(prevInitiatives => prevInitiatives.filter(init => init.id !== id));
    // Also delete any milestones associated with this initiative
    setMilestones(prevMilestones => prevMilestones.filter(m => m.initiativeId !== id));
    setShowEditInitiativeModal(false);
    setEditingInitiative(null);
  };

  // Add Milestone
  const handleAddMilestone = () => {
    if (!newMilestone.date || !newMilestone.description.trim() || !newMilestone.initiativeId) return;
    const newId = `milestone-${Date.now()}`; // Simple unique ID
    setMilestones(prevMilestones => [
      ...prevMilestones,
      {
        id: newId,
        initiativeId: newMilestone.initiativeId,
        date: new Date(newMilestone.date),
        description: newMilestone.description,
      },
    ]);
    setNewMilestone({
      initiativeId: initiatives.length > 0 ? initiatives[0].id : '',
      date: '',
      description: '',
    });
    setShowAddMilestoneModal(false);
  };

  // Update Milestone
  const handleUpdateMilestone = () => {
    if (!editingMilestone) return;
    setMilestones(prevMilestones =>
      prevMilestones.map(milestone =>
        milestone.id === editingMilestone.id
          ? {
              ...milestone,
              initiativeId: editingMilestone.initiativeId,
              date: new Date(editingMilestone.date),
              description: editingMilestone.description,
            }
          : milestone
      )
    );
    setShowEditMilestoneModal(false);
    setEditingMilestone(null);
  };

  // Delete Milestone
  const handleDeleteMilestone = (id) => {
    setMilestones(prevMilestones => prevMilestones.filter(milestone => milestone.id !== id));
    setShowEditMilestoneModal(false);
    setEditingMilestone(null);
  };

  // Add a new time period (next quarter)
  const handleAddTimePeriod = () => {
    const lastPeriod = timePeriods[timePeriods.length - 1];
    let nextStartDate;
    if (lastPeriod) {
      const lastEndDate = new Date(lastPeriod.endDate);
      nextStartDate = new Date(lastEndDate.getFullYear(), lastEndDate.getMonth() + 1, 1);
    } else {
      // If no periods, start from current quarter
      const now = new Date();
      nextStartDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    }

    const nextEndDate = new Date(nextStartDate.getFullYear(), nextStartDate.getMonth() + 3, 0);
    const nextQuarter = Math.floor(nextStartDate.getMonth() / 3) + 1;
    const newId = `${nextStartDate.getFullYear()}-Q${nextQuarter}-${Date.now()}`; // More unique ID
    const newPeriod = {
      id: newId,
      name: `Q${nextQuarter} ${nextStartDate.getFullYear()}`,
      startDate: nextStartDate,
      endDate: nextEndDate,
      order: nextStartDate.getFullYear() * 10 + nextQuarter,
    };
    setTimePeriods(prevPeriods => [...prevPeriods, newPeriod].sort((a, b) => a.order - b.order));
  };

  // Remove a time period
  const handleRemoveTimePeriod = (id) => {
    setTimePeriods(prevPeriods => prevPeriods.filter(period => period.id !== id));
  };

  // Rename a time period
  const handleRenameTimePeriod = (id, newName) => {
    setTimePeriods(prevPeriods =>
      prevPeriods.map(period =>
        period.id === id ? { ...period, name: newName } : period
      )
    );
    setEditingPeriodId(null); // Exit editing mode
    setEditingPeriodName('');
  };

  // Calculate initiative block width and position (in percentages)
  const getInitiativeStyle = useCallback((initiative) => {
    if (timePeriods.length === 0) return { display: 'none' };

    const roadmapMinDate = timePeriods[0].startDate;
    const roadmapMaxDate = timePeriods[timePeriods.length - 1].endDate;
    const totalRoadmapDurationMillis = roadmapMaxDate.getTime() - roadmapMinDate.getTime();

    if (totalRoadmapDurationMillis <= 0) return { display: 'none' };

    const startOffsetMillis = initiative.startDate.getTime() - roadmapMinDate.getTime();
    const endOffsetMillis = initiative.endDate.getTime() - roadmapMinDate.getTime();

    let left = (startOffsetMillis / totalRoadmapDurationMillis) * 100;
    let width = ((endOffsetMillis - startOffsetMillis) / totalRoadmapDurationMillis) * 100;

    // Ensure left and width are within bounds (0-100%)
    left = Math.max(0, left);
    width = Math.min(100 - left, width); // Ensure width doesn't push it beyond 100%

    return {
      left: `${left}%`,
      width: `${width}%`,
    };
  }, [timePeriods]);

  // This effect updates the functions stored in the ref whenever dependencies change.
  // These functions will capture the latest state values.
  useEffect(() => {
    dragCallbacks.current.handleMouseMove = (e) => {
      // console.log('handleMouseMove (from ref) firing');
      if (!dragState || !roadmapTimePeriodsRef.current || timePeriods.length === 0) {
        // console.log('Early exit in handleMouseMove (from ref). Conditions:', {
        //   dragState: dragState,
        //   roadmapTimePeriodsRefCurrent: roadmapTimePeriodsRef.current,
        //   timePeriodsLength: timePeriods.length
        // });
        return;
      }

      const { id, type, initialMouseX, initialStartDate, initialEndDate } = dragState;

      const currentMouseX = e.clientX;
      const deltaX = currentMouseX - initialMouseX;
      // console.log('e.clientX:', e.clientX, 'deltaX:', deltaX);

      const totalRoadmapWidthPx = roadmapTimePeriodsRef.current.getBoundingClientRect().width;
      const roadmapMinDate = timePeriods[0].startDate;
      const roadmapMaxDate = timePeriods[timePeriods.length - 1].endDate;
      const totalRoadmapDurationMillis = roadmapMaxDate.getTime() - roadmapMinDate.getTime();

      // console.log('totalRoadmapWidthPx:', totalRoadmapWidthPx, 'totalRoadmapDurationMillis:', totalRoadmapDurationMillis);

      if (totalRoadmapWidthPx === 0 || totalRoadmapDurationMillis <= 0) {
        // console.log('Early exit (from ref): totalRoadmapWidthPx is 0 or totalRoadmapDurationMillis <= 0');
        return;
      }

      const pixelsPerMillisecond = totalRoadmapWidthPx / totalRoadmapDurationMillis;
      const deltaMillis = deltaX / pixelsPerMillisecond;
      // console.log('pixelsPerMillisecond:', pixelsPerMillisecond, 'deltaMillis:', deltaMillis);

      setInitiatives(prevInitiatives => prevInitiatives.map(init => {
        if (init.id === id) {
          let newStartDate = new Date(initialStartDate.getTime());
          let newEndDate = new Date(initialEndDate.getTime());

          if (type === 'move') {
            newStartDate = new Date(initialStartDate.getTime() + deltaMillis);
            newEndDate = new Date(initialEndDate.getTime() + deltaMillis);
          } else if (type === 'resizeLeft') {
            newStartDate = new Date(initialStartDate.getTime() + deltaMillis);
            // Ensure newStartDate doesn't go past newEndDate
            if (newStartDate.getTime() > newEndDate.getTime()) {
              newStartDate = new Date(newEndDate.getTime());
            }
          } else if (type === 'resizeRight') {
            newEndDate = new Date(initialEndDate.getTime() + deltaMillis);
            // Ensure newEndDate doesn't go before newStartDate
            if (newEndDate.getTime() < newStartDate.getTime()) {
              newEndDate = new Date(newStartDate.getTime());
            }
          }

          // Clamp dates to overall roadmap boundaries
          const firstPeriodStartDate = timePeriods[0].startDate;
          const lastPeriodEndDate = timePeriods[timePeriods.length - 1].endDate;

          // Clamp newStartDate
          if (newStartDate.getTime() < firstPeriodStartDate.getTime()) {
            newStartDate = firstPeriodStartDate;
            if (type === 'move') {
              const duration = initialEndDate.getTime() - initialStartDate.getTime();
              newEndDate = new Date(newStartDate.getTime() + duration);
            }
          }

          // Clamp newEndDate
          if (newEndDate.getTime() > lastPeriodEndDate.getTime()) {
            newEndDate = lastPeriodEndDate;
            if (type === 'move') {
              const duration = initialEndDate.getTime() - initialStartDate.getTime();
              newStartDate = new Date(newEndDate.getTime() - duration);
            }
          }

          // Final check to ensure start is not after end
          if (newStartDate.getTime() > newEndDate.getTime()) {
              newEndDate = new Date(newStartDate.getTime());
          }
          // console.log('Updated initiative (from ref):', { ...init, startDate: newStartDate, endDate: newEndDate });
          return {
            ...init,
            startDate: newStartDate,
            endDate: newEndDate,
          };
        }
        return init;
      }));
    };

    dragCallbacks.current.handleMouseUp = () => {
      // console.log('handleMouseUp (from ref) firing');
      setDragState(null);
      // Remove the stable global event listeners
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, timePeriods, initiatives]); // Dependencies for the effect

  // Stable global event handler for mouse move
  const handleGlobalMouseMove = useCallback((e) => {
    if (dragCallbacks.current.handleMouseMove) {
      dragCallbacks.current.handleMouseMove(e);
    }
  }, []); // No dependencies, this function reference is stable

  // Stable global event handler for mouse up
  const handleGlobalMouseUp = useCallback(() => {
    if (dragCallbacks.current.handleMouseUp) {
      dragCallbacks.current.handleMouseUp();
    }
  }, []); // No dependencies, this function reference is stable

  // Handle mouse down on an initiative for dragging or resizing
  const handleMouseDown = useCallback((e, initiativeId, actionType = 'move') => {
    // console.log('handleMouseDown triggered');
    e.stopPropagation(); // Prevent opening initiative edit modal immediately

    if (e.button !== 0) return; // Only allow left click

    // Find the initiative from the current state to get its latest dates
    const currentInitiative = initiatives.find(init => init.id === initiativeId);
    if (!currentInitiative) {
      console.log('handleMouseDown: Initiative not found for ID:', initiativeId);
      return;
    }

    setDragState({
      id: initiativeId,
      type: actionType,
      initialMouseX: e.clientX,
      initialStartDate: currentInitiative.startDate,
      initialEndDate: currentInitiative.endDate,
    });
    // console.log('handleMouseDown - dragState set:', { id: initiativeId, type: actionType, initialMouseX: e.clientX, initialStartDate: currentInitiative.startDate, initialEndDate: currentInitiative.endDate });

    // Attach stable global listeners
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }, [initiatives, handleGlobalMouseMove, handleGlobalMouseUp]); // Dependencies for handleMouseDown

  // Calculate dynamic min-width for the roadmap grid
  const themeColumnWidth = 200; // px
  const timePeriodColumnWidth = 150; // px
  const calculatedMinWidth = themeColumnWidth + (timePeriods.length * timePeriodColumnWidth);

  return (
    <div className="min-h-screen bg-gray-50  font-inter text-gray-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-xl p-6 sm:p-8">
        <h1 className="text-4xl font-extrabold text-center text-indigo-700 mb-8">
          Product Roadmap
        </h1>

        <div className="flex justify-start items-center mb-6 flex-wrap gap-4">
          <button
            onClick={() => setShowAddThemeModal(true)}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-200 ease-in-out text-sm font-medium"
          >
            Add Theme
          </button>
          <button
            onClick={() => setShowAddInitiativeModal(true)}
            className="px-5 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition duration-200 ease-in-out text-sm font-medium"
          >
            Add Initiative
          </button>
          <button
            onClick={() => setShowAddMilestoneModal(true)}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition duration-200 ease-in-out text-sm font-medium"
          >
            Add Milestone
          </button>
          <button
            onClick={handleAddTimePeriod}
            className="px-5 py-2 bg-gray-700 text-white rounded-lg shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 transition duration-200 ease-in-out text-sm font-medium"
          >
            Add Time Period
          </button>
        </div>

        {/* Roadmap Grid */}
        <div className="overflow-x-auto">
          <div
            ref={roadmapTimePeriodsRef} // Ref is now on the main grid container
            className="grid border border-gray-200 rounded-lg overflow-hidden"
            style={{ minWidth: `${calculatedMinWidth}px` }}
          >
            {/* Header Row: Time Periods */}
            <div className="grid" style={{ gridTemplateColumns: `200px repeat(${timePeriods.length}, 1fr)` }}>
              <div className="p-3 font-semibold text-gray-700 border-r border-gray-200">Themes</div>
              {timePeriods.map(period => (
                <div key={period.id} className="p-3 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 relative group">
                  {editingPeriodId === period.id ? (
                    <input
                      type="text"
                      value={editingPeriodName}
                      onChange={(e) => setEditingPeriodName(e.target.value)}
                      onBlur={() => handleRenameTimePeriod(period.id, editingPeriodName)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameTimePeriod(period.id, editingPeriodName);
                        }
                      }}
                      className="w-full bg-white border border-indigo-300 rounded-md px-2 py-1 text-center"
                      autoFocus
                    />
                  ) : (
                    <span onDoubleClick={() => {
                      setEditingPeriodId(period.id);
                      setEditingPeriodName(period.name);
                    }}>
                      {period.name}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveTimePeriod(period.id)}
                    className="absolute top-1 right-1 text-gray-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    title="Remove Time Period"
                  >
                    &#x2715; {/* Unicode 'X' character */}
                  </button>
                </div>
              ))}
            </div>

            {/* Theme Rows */}
            {themes.map((theme, themeIndex) => {
              // Filter initiatives for the current theme
              const initiativesInThisTheme = initiatives.filter(initiative => initiative.themeId === theme.id);
              // Calculate the minimum height needed for this theme row based on its initiatives
              const minThemeRowHeight = Math.max(60, initiativesInThisTheme.length * (INITIATIVE_HEIGHT + INITIATIVE_GAP) + INITIATIVE_GAP + MILESTONE_OFFSET_TOP); // Add milestone offset to height

              // Determine the initiative background color based on the theme index
              const currentInitiativeColorClass = initiativeColors[themeIndex % initiativeColors.length];

              return (
                <div
                  key={theme.id}
                  className={`grid border-b border-gray-200 last:border-b-0 ${themeBackgroundColors[themeIndex % themeBackgroundColors.length]}`}
                  style={{ gridTemplateColumns: `200px repeat(${timePeriods.length}, 1fr)` }}
                >
                  <div className="p-4 font-medium text-gray-900 border-r border-gray-200 flex items-center relative group">
                    {theme.name}
                    {/* Delete Theme Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent any other click events on the theme row
                        handleDeleteTheme(theme.id);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      title="Delete Theme"
                    >
                      &#x2715; {/* Unicode 'X' character */}
                    </button>
                  </div>
                  {/* Initiative and Milestone Container */}
                  <div
                    className="relative col-span-full grid" // Re-added grid for background cells
                    style={{
                      gridTemplateColumns: `repeat(${timePeriods.length}, 1fr)`, // Define columns for background cells
                      minHeight: `${minThemeRowHeight}px`, // Apply dynamic height here
                    }}
                  >
                    {/* Background cells with borders for each time period */}
                    {timePeriods.map((period, index) => (
                      <div
                        key={`bg-cell-${period.id}`}
                        className={`p-4 border-r border-gray-200 last:border-r-0`} // Apply border-right to each cell
                        style={{ zIndex: 1 }} // Ensure background cells are behind initiatives
                      >
                        {/* Content of background cell (empty) */}
                      </div>
                    ))}

                    {/* Initiatives for this theme, stacked vertically */}
                    {initiativesInThisTheme.map((initiative, initiativeIndex) => (
                      <div
                        key={initiative.id}
                        className={`absolute text-white rounded-md p-2 text-xs font-medium shadow-md cursor-pointer hover:opacity-90 transition duration-150 ease-in-out whitespace-nowrap text-ellipsis ${currentInitiativeColorClass} group`} /* Added group for hover effect */
                        style={{
                          ...getInitiativeStyle(initiative), // This provides left and width
                          top: `${initiativeIndex * (INITIATIVE_HEIGHT + INITIATIVE_GAP) + INITIATIVE_GAP + MILESTONE_OFFSET_TOP}px`, // Vertical stacking with gap, shifted down for milestones
                          height: `${INITIATIVE_HEIGHT}px`, // Fixed height
                          zIndex: 2, // Ensure initiatives are above background cells
                        }}
                        onMouseDown={(e) => handleMouseDown(e, initiative.id, 'move')} // Pass initiative.id
                      >
                        {/* Left Resize Handle */}
                        <div
                          className="absolute top-0 left-0 h-full"
                          style={{ width: `${RESIZE_HANDLE_WIDTH}px`, cursor: 'ew-resize' }}
                          onMouseDown={(e) => handleMouseDown(e, initiative.id, 'resizeLeft')} // Pass initiative.id
                        ></div>
                        {initiative.name}
                        {/* Right Resize Handle */}
                        <div
                          className="absolute top-0 right-0 h-full"
                          style={{ width: `${RESIZE_HANDLE_WIDTH}px`, cursor: 'ew-resize' }}
                          onMouseDown={(e) => handleMouseDown(e, initiative.id, 'resizeRight')} // Pass initiative.id
                        ></div>
                        {/* Delete Initiative Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent drag/edit on click
                            handleDeleteInitiative(initiative.id);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          title="Delete Initiative"
                        >
                          &#x2715; {/* Unicode 'X' character */}
                        </button>

                        {/* Milestones within this initiative */}
                        {milestones
                          .filter(m => m.initiativeId === initiative.id)
                          .map(milestone => {
                            // Calculate position relative to initiative's start and end dates
                            const initiativeStartMillis = initiative.startDate.getTime();
                            const initiativeEndMillis = initiative.endDate.getTime();
                            const milestoneDateMillis = milestone.date.getTime();

                            const totalInitiativeDuration = initiativeEndMillis - initiativeStartMillis;
                            const milestoneOffset = milestoneDateMillis - initiativeStartMillis;

                            let leftPosition = 0;
                            if (totalInitiativeDuration > 0) {
                              leftPosition = (milestoneOffset / totalInitiativeDuration) * 100;
                            }

                            // Clamp position to be within 0% and 100%
                            leftPosition = Math.max(0, Math.min(100, leftPosition));

                            return (
                              <div
                                key={milestone.id}
                                className="absolute z-20 cursor-pointer flex items-center space-x-1 px-1 rounded group" /* Added group for hover effect */
                                style={{
                                  left: `${leftPosition}%`,
                                  top: `-${MILESTONE_OFFSET_TOP}px`, // Position at the top of the initiative block
                                  transform: 'translateX(-50%)', // Center the marker
                                  width: 'max-content', // Allow content to dictate width
                                  whiteSpace: 'nowrap', // Prevent wrapping
                                  fontSize: '0.65rem', // Smaller text for milestones
                                  color: 'white', // Ensure text is visible
                                  backgroundColor: 'rgba(128, 0, 128, 0.8)', // Darker purple background for contrast
                                  pointerEvents: 'auto', // Ensure clickability
                                }}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent opening initiative edit modal
                                  setEditingMilestone({
                                    ...milestone,
                                    date: milestone.date.toISOString().split('T')[0],
                                  });
                                  setShowEditMilestoneModal(true);
                                }}
                              >
                                <span className="inline-block bg-purple-400 rounded-full w-2 h-2 border border-white shadow-sm"></span>
                                <span className="text-white">{milestone.description}</span> {/* Display description with white text */}
                                {/* Delete Milestone Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent opening milestone edit modal
                                    handleDeleteMilestone(milestone.id);
                                  }}
                                  className="ml-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                  title="Delete Milestone"
                                >
                                  &#x2715; {/* Unicode 'X' character */}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modals */}

        {/* Add Theme Modal */}
        {showAddThemeModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-indigo-700">Add New Theme</h2>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Theme Name"
                value={newThemeName}
                onChange={(e) => setNewThemeName(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAddThemeModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTheme}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200"
                >
                  Add Theme
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Initiative Modal */}
        {showAddInitiativeModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-green-700">Add New Initiative</h2>
              <select
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-green-500 focus:border-green-500"
                value={newInitiative.themeId}
                onChange={(e) => setNewInitiative({ ...newInitiative, themeId: e.target.value })}
              >
                <option value="">Select Theme</option>
                {themes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-green-500 focus:border-green-500"
                placeholder="Initiative Name"
                value={newInitiative.name}
                onChange={(e) => setNewInitiative({ ...newInitiative, name: e.target.value })}
              />
              <textarea
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-green-500 focus:border-green-500"
                placeholder="Description"
                value={newInitiative.description}
                onChange={(e) => setNewInitiative({ ...newInitiative, description: e.target.value })}
              ></textarea>
              <label htmlFor="initiative-start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date:</label>
              <input
                id="initiative-start-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-green-500 focus:border-green-500"
                value={newInitiative.startDate}
                onChange={(e) => setNewInitiative({ ...newInitiative, startDate: e.target.value })}
              />
              <label htmlFor="initiative-end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date:</label>
              <input
                id="initiative-end-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-green-500 focus:border-green-500"
                value={newInitiative.endDate}
                onChange={(e) => setNewInitiative({ ...newInitiative, endDate: e.target.value })}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAddInitiativeModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddInitiative}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200"
                >
                  Add Initiative
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Initiative Modal */}
        {showEditInitiativeModal && editingInitiative && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-blue-700">Edit Initiative</h2>
              <select
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
                value={editingInitiative.themeId}
                onChange={(e) => setEditingInitiative({ ...editingInitiative, themeId: e.target.value })}
              >
                <option value="">Select Theme</option>
                {themes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Initiative Name"
                value={editingInitiative.name}
                onChange={(e) => setEditingInitiative({ ...editingInitiative, name: e.target.value })}
              />
              <textarea
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Description"
                value={editingInitiative.description}
                onChange={(e) => setEditingInitiative({ ...editingInitiative, description: e.target.value })}
              ></textarea>
              <label htmlFor="edit-initiative-start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date:</label>
              <input
                id="edit-initiative-start-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
                value={editingInitiative.startDate}
                onChange={(e) => setEditingInitiative({ ...editingInitiative, startDate: e.target.value })}
              />
              <label htmlFor="edit-initiative-end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date:</label>
              <input
                id="edit-initiative-end-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
                value={editingInitiative.endDate}
                onChange={(e) => setEditingInitiative({ ...editingInitiative, endDate: e.target.value })}
              />
              <div className="flex justify-between gap-3 mt-4">
                <button
                  onClick={() => handleDeleteInitiative(editingInitiative.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowEditInitiativeModal(false); setEditingInitiative(null); }}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateInitiative}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Milestone Modal */}
        {showAddMilestoneModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-purple-700">Add New Milestone</h2>
              <select
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-purple-500 focus:border-purple-500"
                value={newMilestone.initiativeId}
                onChange={(e) => setNewMilestone({ ...newMilestone, initiativeId: e.target.value })}
              >
                <option value="">Select Initiative</option>
                {initiatives.map(initiative => (
                  <option key={initiative.id} value={initiative.id}>{initiative.name}</option>
                ))}
              </select>
              <label htmlFor="milestone-date" className="block text-sm font-medium text-gray-700 mb-1">Date:</label>
              <input
                id="milestone-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-purple-500 focus:border-purple-500"
                value={newMilestone.date}
                onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
              />
              <textarea
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Description"
                value={newMilestone.description}
                onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
              ></textarea>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAddMilestoneModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMilestone}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200"
                >
                  Add Milestone
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Milestone Modal */}
        {showEditMilestoneModal && editingMilestone && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-purple-700">Edit Milestone</h2>
              <select
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-purple-500 focus:border-purple-500"
                value={editingMilestone.initiativeId}
                onChange={(e) => setEditingMilestone({ ...editingMilestone, initiativeId: e.target.value })}
              >
                <option value="">Select Initiative</option>
                {initiatives.map(initiative => (
                  <option key={initiative.id} value={initiative.id}>{initiative.name}</option>
                ))}
              </select>
              <label htmlFor="edit-milestone-date" className="block text-sm font-medium text-gray-700 mb-1">Date:</label>
              <input
                id="edit-milestone-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-purple-500 focus:border-purple-500"
                value={editingMilestone.date}
                onChange={(e) => setEditingMilestone({ ...editingMilestone, date: e.target.value })}
              />
              <textarea
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Description"
                value={editingMilestone.description}
                onChange={(e) => setEditingMilestone({ ...editingMilestone, description: e.target.value })}
              ></textarea>
              <div className="flex justify-between gap-3 mt-4">
                <button
                  onClick={() => handleDeleteMilestone(editingMilestone.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowEditMilestoneModal(false); setEditingMilestone(null); }}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateMilestone}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
