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
    maxMindMaps: 1,
    maxNodesPerMap: 50,
    maxCollaborators: 0,
    allowedExportFormats: ['png'],
    features: {
      basicTemplates: true,
      customColors: false,
      realTimeCollaboration: false,
      versionHistory: false,
      aiSuggestions: false,
      aiExpand: false,
      aiGeneration: false,
      aiAnalysis: false,
      communityTemplates: false,
      prioritySupport: false,
      earlyAccess: false
    }
  },
  [USER_TIERS.STARTER]: {
    maxMindMaps: 5,
    maxNodesPerMap: 100,
    maxCollaborators: 1,
    allowedExportFormats: ['png', 'pdf', 'markdown'],
    features: {
      basicTemplates: true,
      customColors: true,
      realTimeCollaboration: false,
      versionHistory: true,
      aiSuggestions: false,
      aiExpand: false,
      aiGeneration: false,
      aiAnalysis: false,
      communityTemplates: true,
      prioritySupport: false,
      earlyAccess: false
    }
  },
  [USER_TIERS.PRO]: {
    maxMindMaps: 20,
    maxNodesPerMap: 500,
    maxCollaborators: 5,
    allowedExportFormats: ['png', 'pdf', 'markdown', 'json', 'mm', 'fig', 'notion'],
    features: {
      basicTemplates: true,
      customColors: true,
      realTimeCollaboration: true,
      versionHistory: true,
      aiSuggestions: true,
      aiExpand: true,
      aiGeneration: false,
      aiAnalysis: false,
      communityTemplates: true,
      prioritySupport: true,
      earlyAccess: false
    }
  },
  [USER_TIERS.CREATOR_AI]: {
    maxMindMaps: -1, // unlimited
    maxNodesPerMap: -1, // unlimited
    maxCollaborators: -1, // unlimited
    allowedExportFormats: ['png', 'pdf', 'markdown', 'json', 'mm', 'svg', 'xml', 'yaml', 'docx', 'fig', 'notion'],
    features: {
      basicTemplates: true,
      customColors: true,
      realTimeCollaboration: true,
      versionHistory: true,
      aiSuggestions: true,
      aiExpand: true,
      aiGeneration: true,
      aiAnalysis: true,
      communityTemplates: true,
      prioritySupport: true,
      earlyAccess: true
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