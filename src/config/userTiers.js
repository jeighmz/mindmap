// User tier definitions and their features
export const USER_TIERS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  CREATOR_AI: 'CREATOR_AI'
};

// Feature flags for each tier
export const TIER_FEATURES = {
  [USER_TIERS.FREE]: {
    maxMindMaps: 3, // Saved boards (cloud)
    maxNodesPerMap: -1, // Unlimited (Manual mind maps: Unlimited)
    maxCollaborators: 0,
    allowedExportFormats: ['png'],
    // Daily limits (-1 = unlimited, 0 = not available)
    dailyAIGeneratedMaps: 4,
    dailyAIAnalysisMessages: 0,
    dailyExpandTool: 4,
    // Multi-board AI chat memory (-1 = unlimited, 0 = not available)
    multiBoardAIChatMemory: 0,
    features: {
      autosave: true,
      visionModelSupport: false,
      fullAIEditingTools: false, // Rewrite / Summarize / Structure
      noWatermark: false,
      realTimeCollaboration: false,
      fastestComputePriority: false,
      experimentalFeatures: false
    }
  },
  [USER_TIERS.STARTER]: {
    maxMindMaps: 20, // Saved boards (cloud)
    maxNodesPerMap: -1, // Unlimited (Manual mind maps: Unlimited)
    maxCollaborators: 0,
    allowedExportFormats: ['png', 'pdf', 'markdown'],
    // Daily limits
    dailyAIGeneratedMaps: -1, // Unlimited
    dailyAIAnalysisMessages: 4,
    dailyExpandTool: 4,
    // Multi-board AI chat memory
    multiBoardAIChatMemory: 0,
    features: {
      autosave: true,
      visionModelSupport: true,
      fullAIEditingTools: false,
      noWatermark: false,
      realTimeCollaboration: false,
      fastestComputePriority: false,
      experimentalFeatures: false
    }
  },
  [USER_TIERS.PRO]: {
    maxMindMaps: 100, // Saved boards (cloud)
    maxNodesPerMap: -1, // Unlimited (Manual mind maps: Unlimited)
    maxCollaborators: 0,
    allowedExportFormats: ['png', 'pdf', 'markdown', 'json', 'mm'],
    // Daily limits
    dailyAIGeneratedMaps: -1, // Unlimited
    dailyAIAnalysisMessages: -1, // Unlimited
    dailyExpandTool: -1, // Unlimited
    // Multi-board AI chat memory
    multiBoardAIChatMemory: 3,
    features: {
      autosave: true,
      visionModelSupport: true,
      fullAIEditingTools: true,
      noWatermark: true,
      realTimeCollaboration: false,
      fastestComputePriority: false,
      experimentalFeatures: false
    }
  },
  [USER_TIERS.CREATOR_AI]: {
    maxMindMaps: -1, // Unlimited (Saved boards: Unlimited)
    maxNodesPerMap: -1, // Unlimited (Manual mind maps: Unlimited)
    maxCollaborators: -1, // Unlimited
    allowedExportFormats: ['png', 'pdf', 'markdown', 'json', 'mm'],
    // Daily limits
    dailyAIGeneratedMaps: -1, // Unlimited
    dailyAIAnalysisMessages: -1, // Unlimited
    dailyExpandTool: -1, // Unlimited
    // Multi-board AI chat memory
    multiBoardAIChatMemory: -1, // Unlimited
    features: {
      autosave: true,
      visionModelSupport: true,
      fullAIEditingTools: true,
      noWatermark: true,
      realTimeCollaboration: true,
      fastestComputePriority: true,
      experimentalFeatures: true
    }
  }
};

// Pricing information (in USD)
export const TIER_PRICING = {
  [USER_TIERS.FREE]: {
    monthly: 0,
    annual: 0
  },
  [USER_TIERS.STARTER]: {
    monthly: 9,
    annual: 90
  },
  [USER_TIERS.PRO]: {
    monthly: 29,
    annual: 290
  },
  [USER_TIERS.CREATOR_AI]: {
    monthly: 59,
    annual: 590
  }
};

// Feature descriptions for display
export const FEATURE_DESCRIPTIONS = {
  maxMindMaps: 'Number of mind maps you can create',
  maxNodesPerMap: 'Maximum nodes per mind map',
  maxCollaborators: 'Number of collaborators per mind map',
  allowedExportFormats: 'Available export formats',
  basicTemplates: 'Basic templates',
  customColors: 'Custom colors and themes',
  realTimeCollaboration: 'Real-time collaboration',
  versionHistory: 'Version history',
  aiSuggestions: 'AI-powered suggestions',
  aiExpand: 'AI "Expand" tool',
  aiGeneration: 'Full AI-generated maps',
  aiAnalysis: 'AI analysis panel',
  communityTemplates: 'Community templates',
  prioritySupport: 'Priority support',
  earlyAccess: 'Early access to new features'
};

// Export format descriptions
export const EXPORT_FORMAT_DESCRIPTIONS = {
  png: 'Basic visual sharing',
  pdf: 'Professional sharing and printing',
  markdown: 'Note-taking and documentation',
  json: 'Data-driven integration and web app compatibility',
  mm: 'Compatible with external mind mapping software',
  svg: 'High-quality vector graphics',
  xml: 'Flexible system integration',
  yaml: 'Human-readable data format',
  docx: 'Professional documentation workflows',
  fig: 'Figma design integration'
};

export const getFeatureLimit = (tier, feature) => {
  return TIER_FEATURES[tier]?.[feature] ?? 0;
};

export const canUseFeature = (tier, feature) => {
  return TIER_FEATURES[tier]?.features?.[feature] ?? false;
};

export const isExportFormatAllowed = (tier, format) => {
  return TIER_FEATURES[tier]?.allowedExportFormats?.includes(format) ?? false;
}; 