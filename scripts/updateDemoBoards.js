const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Helper function to generate unique IDs
const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const generateConnectionId = () => `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Validation function to check if a connection makes logical sense
const validateConnection = (fromItem, toItem, allItems, existingConnections) => {
  // Don't connect item to itself
  if (fromItem.id === toItem.id) return false;
  
  // Don't create duplicate connections
  if (existingConnections.some(c => 
    (c.from === fromItem.id && c.to === toItem.id) ||
    (c.from === toItem.id && c.to === fromItem.id)
  )) return false;
  
  // Calculate distance and angle
  const dx = toItem.position.x - fromItem.position.x;
  const dy = toItem.position.y - fromItem.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Don't connect items that are too far apart (contextual threshold)
  const maxDistance = 600; // Maximum reasonable connection distance
  if (distance > maxDistance) return false;
  
  // Check if items are in a logical hierarchical relationship
  // Parent should be closer to center, child should be further
  const centerItem = allItems[0];
  const fromToCenter = Math.sqrt(
    Math.pow(fromItem.position.x - centerItem.position.x, 2) +
    Math.pow(fromItem.position.y - centerItem.position.y, 2)
  );
  const toToCenter = Math.sqrt(
    Math.pow(toItem.position.x - centerItem.position.x, 2) +
    Math.pow(toItem.position.y - centerItem.position.y, 2)
  );
  
  // Child should generally be further from center than parent
  // But allow some flexibility for lateral connections
  const isHierarchical = toToCenter > fromToCenter - 100;
  
  // Check order relationship - child should have higher order than parent
  const orderValid = toItem.order > fromItem.order;
  
  // Check if there are other items between them that should be connected instead
  const itemsBetween = allItems.filter(item => {
    if (item.id === fromItem.id || item.id === toItem.id) return false;
    
    // Check if item is on the line between from and to
    const itemDx = item.position.x - fromItem.position.x;
    const itemDy = item.position.y - fromItem.position.y;
    const itemDistance = Math.sqrt(itemDx * itemDx + itemDy * itemDy);
    
    if (itemDistance > distance) return false; // Item is beyond target
    
    // Check if item is closer to the line between from and to
    const crossProduct = Math.abs((dx * itemDy - dy * itemDx));
    const lineDistance = crossProduct / distance;
    
    return lineDistance < 150 && itemDistance < distance * 0.8;
  });
  
  // If there's a closer item in the path, don't create this connection
  if (itemsBetween.length > 0) {
    // Check if any intermediate item should be connected instead
    const hasBetterPath = itemsBetween.some(intermediate => {
      const intermediateOrder = intermediate.order;
      return intermediateOrder > fromItem.order && 
             intermediateOrder < toItem.order &&
             Math.abs(intermediateOrder - fromItem.order) < Math.abs(toItem.order - fromItem.order);
    });
    
    if (hasBetterPath) return false;
  }
  
  // Charts and sticky notes should generally not be connected to each other
  // They're usually standalone or connected to main concepts
  if ((fromItem.type === 'chart' || fromItem.type === 'sticky') && 
      (toItem.type === 'chart' || toItem.type === 'sticky')) {
    // Only allow if one is clearly a parent concept
    if (fromItem.type !== 'circle' && fromItem.type !== 'rectangle') return false;
  }
  
  // Validate based on item types
  // Circles and rectangles can connect to anything
  // Charts should only connect to main concepts (low order)
  if (toItem.type === 'chart' && fromItem.order > 5) return false;
  
  // Sticky notes should connect to nearby main concepts
  if (toItem.type === 'sticky') {
    if (fromItem.order > 8) return false; // Don't connect sticky to deep children
    if (distance > 400) return false; // Sticky should be close to parent
  }
  
  // Main validation: hierarchical and order-based
  return isHierarchical && orderValid;
};

// Create demo boards with complex structure
const createDemoBoards = async () => {
  const boards = [
    {
      name: 'App Monetization Strategy',
      content: {
        items: [
          {
            id: generateId(),
            type: 'circle',
            text: 'How to generate revenue with an app',
            position: { x: 993, y: 499 },
            width: 150,
            height: 150,
            order: 0
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'App Monetization Models',
            position: { x: 950.5, y: 342 },
            width: 235,
            height: 64,
            order: 1
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'In-App Purchase Options',
            position: { x: 927.66, y: 224.39 },
            width: 233,
            height: 64,
            order: 2
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Subscription Based Services',
            position: { x: 988.18, y: 106.78 },
            width: 255,
            height: 64,
            order: 3
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Targeted Advertising',
            position: { x: 1284.5, y: 542 },
            width: 207,
            height: 64,
            order: 4
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Banner Ad Implementations',
            position: { x: 1596.72, y: 474.45 },
            width: 249,
            height: 64,
            order: 5,
            backgroundColor: '#00FFFF'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Interstitial Ad Strategies',
            position: { x: 1548.42, y: 597.63 },
            width: 228,
            height: 64,
            order: 6
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Data Analytics Sales',
            position: { x: 966, y: 742 },
            width: 204,
            height: 64,
            order: 7
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'User Behavior Tracking',
            position: { x: 980.84, y: 859.61 },
            width: 222,
            height: 64,
            order: 8
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Market Trend Insights',
            position: { x: 913.82, y: 977.22 },
            width: 213,
            height: 64,
            order: 9
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Premium Content Offers',
            position: { x: 634, y: 542 },
            width: 228,
            height: 64,
            order: 10
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Exclusive Feature Unlocking',
            position: { x: 288.78, y: 609.55 },
            width: 252,
            height: 64,
            order: 11,
            backgroundColor: '#FF0000'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Sponsored Content Partnerships',
            position: { x: 274.78, y: 474.45 },
            width: 280,
            height: 64,
            order: 12,
            backgroundColor: '#FF0000'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'Revenue Growth Notes',
            position: { x: 670, y: 100 },
            width: 150,
            height: 150,
            order: 22,
            backgroundColor: '#FFFF00'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'Key Metrics to Track',
            position: { x: 670, y: 270 },
            width: 150,
            height: 150,
            order: 28,
            backgroundColor: '#0000FF'
          },
          {
            id: generateId(),
            type: 'chart',
            chartType: 'sine',
            position: { x: 1250, y: 660 },
            width: 650,
            height: 410,
            text: '',
            order: 19,
            title: 'Revenue Growth Over Time',
            xAxisTitle: 'Time (Months)',
            yAxisTitle: 'Revenue ($)',
            showXAxisLabels: true,
            showYAxisLabels: true,
            xAxisUnit: 1,
            yAxisUnit: 1,
            xAxisStart: 0,
            xAxisEnd: 10,
            yAxisStart: -3,
            yAxisEnd: 3,
            periods: 2,
            frequency: 1,
            amplitude: 1,
            waveType: 'sine'
          },
          {
            id: generateId(),
            type: 'chart',
            chartType: 'xy',
            position: { x: 310, y: 690 },
            width: 520,
            height: 380,
            text: '',
            order: 42,
            title: 'User Acquisition vs Revenue',
            xAxisTitle: 'Users',
            yAxisTitle: 'Revenue',
            showXAxisLabels: true,
            showYAxisLabels: true,
            xAxisUnit: 1,
            yAxisUnit: 1,
            xAxisStart: 0,
            xAxisEnd: 10,
            yAxisStart: 0,
            yAxisEnd: 10,
            xAxisMode: 'number',
            yAxisMode: 'number'
          }
        ],
        connections: [],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Product Development Roadmap',
      content: {
        items: [
          {
            id: generateId(),
            type: 'circle',
            text: 'Product Development',
            position: { x: 800, y: 500 },
            width: 180,
            height: 180,
            order: 0
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Research & Discovery',
            position: { x: 600, y: 300 },
            width: 220,
            height: 70,
            order: 1
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'User Interviews',
            position: { x: 450, y: 150 },
            width: 200,
            height: 60,
            order: 2,
            backgroundColor: '#4CAF50'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Market Analysis',
            position: { x: 680, y: 150 },
            width: 200,
            height: 60,
            order: 3,
            backgroundColor: '#4CAF50'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Design & Prototyping',
            position: { x: 1000, y: 300 },
            width: 220,
            height: 70,
            order: 4
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Wireframes',
            position: { x: 950, y: 150 },
            width: 180,
            height: 60,
            order: 5,
            backgroundColor: '#FF9800'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'User Testing',
            position: { x: 1150, y: 150 },
            width: 180,
            height: 60,
            order: 6,
            backgroundColor: '#FF9800'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Development',
            position: { x: 600, y: 700 },
            width: 220,
            height: 70,
            order: 7
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Frontend Development',
            position: { x: 450, y: 850 },
            width: 200,
            height: 60,
            order: 8,
            backgroundColor: '#2196F3'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Backend Development',
            position: { x: 680, y: 850 },
            width: 200,
            height: 60,
            order: 9,
            backgroundColor: '#2196F3'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Testing & QA',
            position: { x: 1000, y: 700 },
            width: 220,
            height: 70,
            order: 10
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Unit Tests',
            position: { x: 950, y: 850 },
            width: 180,
            height: 60,
            order: 11,
            backgroundColor: '#9C27B0'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Integration Tests',
            position: { x: 1150, y: 850 },
            width: 180,
            height: 60,
            order: 12,
            backgroundColor: '#9C27B0'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'MVP Launch Target: Q2 2024',
            position: { x: 1300, y: 500 },
            width: 180,
            height: 160,
            order: 13,
            backgroundColor: '#FFEB3B'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'Key Milestones',
            position: { x: 200, y: 500 },
            width: 180,
            height: 160,
            order: 14,
            backgroundColor: '#E91E63'
          },
          {
            id: generateId(),
            type: 'chart',
            chartType: 'sine',
            position: { x: 200, y: 1000 },
            width: 600,
            height: 400,
            text: '',
            order: 15,
            title: 'Development Velocity',
            xAxisTitle: 'Sprint',
            yAxisTitle: 'Story Points',
            showXAxisLabels: true,
            showYAxisLabels: true,
            xAxisUnit: 1,
            yAxisUnit: 5,
            xAxisStart: 0,
            xAxisEnd: 12,
            yAxisStart: 0,
            yAxisEnd: 50,
            periods: 3,
            frequency: 1,
            amplitude: 20,
            waveType: 'sine'
          }
        ],
        connections: [],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Marketing Campaign Strategy',
      content: {
        items: [
          {
            id: generateId(),
            type: 'circle',
            text: 'Marketing Campaign',
            position: { x: 900, y: 600 },
            width: 170,
            height: 170,
            order: 0
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Digital Marketing',
            position: { x: 1100, y: 400 },
            width: 240,
            height: 75,
            order: 1
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Social Media Campaigns',
            position: { x: 1200, y: 200 },
            width: 250,
            height: 65,
            order: 2,
            backgroundColor: '#3B5998'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Content Marketing',
            position: { x: 1050, y: 200 },
            width: 220,
            height: 65,
            order: 3,
            backgroundColor: '#3B5998'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'SEO & SEM',
            position: { x: 1350, y: 200 },
            width: 200,
            height: 65,
            order: 4,
            backgroundColor: '#3B5998'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Traditional Marketing',
            position: { x: 700, y: 400 },
            width: 240,
            height: 75,
            order: 5
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Print Advertising',
            position: { x: 600, y: 200 },
            width: 200,
            height: 65,
            order: 6,
            backgroundColor: '#F44336'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'TV & Radio',
            position: { x: 800, y: 200 },
            width: 200,
            height: 65,
            order: 7,
            backgroundColor: '#F44336'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Event Marketing',
            position: { x: 900, y: 800 },
            width: 240,
            height: 75,
            order: 8
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Trade Shows',
            position: { x: 800, y: 1000 },
            width: 200,
            height: 65,
            order: 9,
            backgroundColor: '#FF9800'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Webinars',
            position: { x: 1000, y: 1000 },
            width: 200,
            height: 65,
            order: 10,
            backgroundColor: '#FF9800'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'Budget: $500K\nTimeline: 6 months',
            position: { x: 1400, y: 600 },
            width: 180,
            height: 180,
            order: 11,
            backgroundColor: '#4CAF50'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'Target: 10K new customers',
            position: { x: 500, y: 600 },
            width: 180,
            height: 180,
            order: 12,
            backgroundColor: '#2196F3'
          },
          {
            id: generateId(),
            type: 'chart',
            chartType: 'xy',
            position: { x: 500, y: 1200 },
            width: 700,
            height: 450,
            text: '',
            order: 13,
            title: 'Marketing ROI Analysis',
            xAxisTitle: 'Marketing Spend ($)',
            yAxisTitle: 'Revenue Generated ($)',
            showXAxisLabels: true,
            showYAxisLabels: true,
            xAxisUnit: 10000,
            yAxisUnit: 50000,
            xAxisStart: 0,
            xAxisEnd: 500000,
            yAxisStart: 0,
            yAxisEnd: 2000000,
            xAxisMode: 'number',
            yAxisMode: 'number'
          }
        ],
        connections: [],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Technology Stack Architecture',
      content: {
        items: [
          {
            id: generateId(),
            type: 'circle',
            text: 'Tech Stack',
            position: { x: 850, y: 550 },
            width: 160,
            height: 160,
            order: 0
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Frontend Framework',
            position: { x: 1050, y: 350 },
            width: 230,
            height: 70,
            order: 1
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'React',
            position: { x: 1100, y: 200 },
            width: 180,
            height: 60,
            order: 2,
            backgroundColor: '#61DAFB'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Vue.js',
            position: { x: 1300, y: 200 },
            width: 180,
            height: 60,
            order: 3,
            backgroundColor: '#4FC08D'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Backend Services',
            position: { x: 650, y: 350 },
            width: 230,
            height: 70,
            order: 4
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Node.js',
            position: { x: 600, y: 200 },
            width: 180,
            height: 60,
            order: 5,
            backgroundColor: '#339933'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Python',
            position: { x: 800, y: 200 },
            width: 180,
            height: 60,
            order: 6,
            backgroundColor: '#3776AB'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Database',
            position: { x: 1050, y: 750 },
            width: 230,
            height: 70,
            order: 7
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'PostgreSQL',
            position: { x: 1100, y: 900 },
            width: 200,
            height: 60,
            order: 8,
            backgroundColor: '#336791'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'MongoDB',
            position: { x: 1320, y: 900 },
            width: 200,
            height: 60,
            order: 9,
            backgroundColor: '#47A248'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Cloud Infrastructure',
            position: { x: 650, y: 750 },
            width: 230,
            height: 70,
            order: 10
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'AWS',
            position: { x: 600, y: 900 },
            width: 180,
            height: 60,
            order: 11,
            backgroundColor: '#FF9900'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Docker',
            position: { x: 800, y: 900 },
            width: 180,
            height: 60,
            order: 12,
            backgroundColor: '#2496ED'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'Microservices Architecture\nScalable & Maintainable',
            position: { x: 1400, y: 550 },
            width: 200,
            height: 200,
            order: 13,
            backgroundColor: '#9C27B0'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'CI/CD Pipeline\nAutomated Deployment',
            position: { x: 400, y: 550 },
            width: 200,
            height: 200,
            order: 14,
            backgroundColor: '#FF5722'
          },
          {
            id: generateId(),
            type: 'chart',
            chartType: 'sine',
            position: { x: 400, y: 1100 },
            width: 800,
            height: 420,
            text: '',
            order: 15,
            title: 'System Performance Metrics',
            xAxisTitle: 'Time (Hours)',
            yAxisTitle: 'Response Time (ms)',
            showXAxisLabels: true,
            showYAxisLabels: true,
            xAxisUnit: 1,
            yAxisUnit: 50,
            xAxisStart: 0,
            xAxisEnd: 24,
            yAxisStart: 0,
            yAxisEnd: 500,
            periods: 4,
            frequency: 1,
            amplitude: 200,
            waveType: 'sine'
          }
        ],
        connections: [],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Customer Journey Mapping',
      content: {
        items: [
          {
            id: generateId(),
            type: 'circle',
            text: 'Customer Journey',
            position: { x: 800, y: 500 },
            width: 180,
            height: 180,
            order: 0
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Awareness',
            position: { x: 400, y: 300 },
            width: 200,
            height: 70,
            order: 1,
            backgroundColor: '#E3F2FD'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Social Media',
            position: { x: 300, y: 150 },
            width: 180,
            height: 60,
            order: 2,
            backgroundColor: '#BBDEFB'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Search Ads',
            position: { x: 500, y: 150 },
            width: 180,
            height: 60,
            order: 3,
            backgroundColor: '#BBDEFB'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Consideration',
            position: { x: 800, y: 300 },
            width: 200,
            height: 70,
            order: 4,
            backgroundColor: '#FFF3E0'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Product Reviews',
            position: { x: 700, y: 150 },
            width: 200,
            height: 60,
            order: 5,
            backgroundColor: '#FFE0B2'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Comparison',
            position: { x: 920, y: 150 },
            width: 200,
            height: 60,
            order: 6,
            backgroundColor: '#FFE0B2'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Purchase',
            position: { x: 1200, y: 300 },
            width: 200,
            height: 70,
            order: 7,
            backgroundColor: '#E8F5E9'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Checkout',
            position: { x: 1150, y: 150 },
            width: 200,
            height: 60,
            order: 8,
            backgroundColor: '#C8E6C9'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Payment',
            position: { x: 1370, y: 150 },
            width: 200,
            height: 60,
            order: 9,
            backgroundColor: '#C8E6C9'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Retention',
            position: { x: 1200, y: 700 },
            width: 200,
            height: 70,
            order: 10,
            backgroundColor: '#F3E5F5'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Email Campaigns',
            position: { x: 1150, y: 850 },
            width: 200,
            height: 60,
            order: 11,
            backgroundColor: '#E1BEE7'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Loyalty Program',
            position: { x: 1370, y: 850 },
            width: 200,
            height: 60,
            order: 12,
            backgroundColor: '#E1BEE7'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Advocacy',
            position: { x: 800, y: 700 },
            width: 200,
            height: 70,
            order: 13,
            backgroundColor: '#FFF9C4'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Referrals',
            position: { x: 700, y: 850 },
            width: 200,
            height: 60,
            order: 14,
            backgroundColor: '#FFF59D'
          },
          {
            id: generateId(),
            type: 'rectangle',
            text: 'Reviews',
            position: { x: 920, y: 850 },
            width: 200,
            height: 60,
            order: 15,
            backgroundColor: '#FFF59D'
          },
          {
            id: generateId(),
            type: 'sticky',
            text: 'Key Touchpoints\nTrack & Optimize',
            position: { x: 400, y: 700 },
            width: 180,
            height: 180,
            order: 16,
            backgroundColor: '#FF9800'
          },
          {
            id: generateId(),
            type: 'chart',
            chartType: 'xy',
            position: { x: 300, y: 1100 },
            width: 1000,
            height: 450,
            text: '',
            order: 17,
            title: 'Customer Conversion Funnel',
            xAxisTitle: 'Stage',
            yAxisTitle: 'Customers',
            showXAxisLabels: true,
            showYAxisLabels: true,
            xAxisUnit: 1,
            yAxisUnit: 100,
            xAxisStart: 0,
            xAxisEnd: 5,
            yAxisStart: 0,
            yAxisEnd: 1000,
            xAxisMode: 'number',
            yAxisMode: 'number'
          }
        ],
        connections: [],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    }
  ];

  // Create hierarchical connections for each board
  boards.forEach((board, boardIndex) => {
    const items = board.content.items;
    const centerItem = items[0]; // First item is the center
    const connections = [];
    
    // Find main branches (items that should connect directly to center)
    // These are typically first-level concepts (order 1-10, positioned around center)
    const mainBranches = items.filter((item, index) => {
      if (index === 0) return false; // Skip center itself
      
      // Calculate distance from center
      const distance = Math.sqrt(
        Math.pow(item.position.x - centerItem.position.x, 2) +
        Math.pow(item.position.y - centerItem.position.y, 2)
      );
      
      // Main branches are close to center and have low order numbers
      const isMainBranch = item.order > 0 && 
                          item.order <= 10 && 
                          distance < 500 &&
                          (item.type === 'rectangle' || item.type === 'circle');
      
      return isMainBranch;
    });
    
    // Sort main branches by order for consistent connection creation
    mainBranches.sort((a, b) => a.order - b.order);
    
    // Connect center to main branches (limit to reasonable number)
    mainBranches.slice(0, 8).forEach((branch) => {
      if (validateConnection(centerItem, branch, items, connections)) {
        connections.push({
          id: generateConnectionId(),
          from: centerItem.id,
          to: branch.id,
          color: '#2196F3',
          strokeWidth: 2,
          lineType: 'straight',
          lineDesign: 'curved',
          arrowDirection: '->',
          arrowHeadStyle: 'medium'
        });
      }
    });
    
    // For each main branch, find its direct children
    mainBranches.forEach((branch) => {
      // Find potential children - items that are:
      // 1. Positioned near the branch
      // 2. Have higher order number
      // 3. Are logically related
      const potentialChildren = items.filter(item => {
        if (item.id === branch.id || item.id === centerItem.id) return false;
        
        const distance = Math.sqrt(
          Math.pow(item.position.x - branch.position.x, 2) +
          Math.pow(item.position.y - branch.position.y, 2)
        );
        
        // Child should be reasonably close and have higher order
        const isPotentialChild = distance < 450 && 
                                 item.order > branch.order &&
                                 item.order < branch.order + 15;
        
        return isPotentialChild;
      });
      
      // Sort by order and distance to find best matches
      potentialChildren.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.position.x - branch.position.x, 2) +
          Math.pow(a.position.y - branch.position.y, 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.position.x - branch.position.x, 2) +
          Math.pow(b.position.y - branch.position.y, 2)
        );
        
        // Prioritize by order, then distance
        if (a.order !== b.order) return a.order - b.order;
        return distA - distB;
      });
      
      // Connect branch to its direct children (limit to prevent over-connecting)
      let childCount = 0;
      const maxChildrenPerBranch = 4;
      
      potentialChildren.forEach(child => {
        if (childCount >= maxChildrenPerBranch) return;
        
        // Validate this connection makes sense
        if (validateConnection(branch, child, items, connections)) {
          // Check if this child is already connected to another parent
          const alreadyConnected = connections.some(c => c.to === child.id);
          
          // Allow connection if not already connected, or if this is a better parent
          if (!alreadyConnected) {
            connections.push({
              id: generateConnectionId(),
              from: branch.id,
              to: child.id,
              color: '#2196F3',
              strokeWidth: 2,
              lineType: 'straight',
              lineDesign: 'curved',
              arrowDirection: '->',
              arrowHeadStyle: 'medium'
            });
            childCount++;
          }
        }
      });
    });
    
    // Connect sticky notes and charts to nearby main concepts (not to each other)
    items.forEach(item => {
      if (item.type === 'sticky' || item.type === 'chart') {
        // Find the closest main concept (rectangle or circle with low order)
        const mainConcepts = items.filter(other => 
          (other.type === 'rectangle' || other.type === 'circle') &&
          other.id !== item.id &&
          other.order <= 10
        );
        
        if (mainConcepts.length > 0) {
          // Find closest main concept
          let closestConcept = null;
          let minDistance = Infinity;
          
          mainConcepts.forEach(concept => {
            const distance = Math.sqrt(
              Math.pow(item.position.x - concept.position.x, 2) +
              Math.pow(item.position.y - concept.position.y, 2)
            );
            
            if (distance < minDistance && distance < 500) {
              minDistance = distance;
              closestConcept = concept;
            }
          });
          
          // Connect to closest concept if validation passes
          if (closestConcept && validateConnection(closestConcept, item, items, connections)) {
            // Check if already connected
            const alreadyConnected = connections.some(c => 
              (c.from === closestConcept.id && c.to === item.id) ||
              (c.from === item.id && c.to === closestConcept.id)
            );
            
            if (!alreadyConnected) {
              connections.push({
                id: generateConnectionId(),
                from: closestConcept.id,
                to: item.id,
                color: '#2196F3',
                strokeWidth: 2,
                lineType: 'straight',
                lineDesign: 'curved',
                arrowDirection: '->',
                arrowHeadStyle: 'medium'
              });
            }
          }
        }
      }
    });
    
    board.content.connections = connections;
  });

  try {
    console.log('🗑️  Step 1: Deleting existing demo boards...');
    
    // Delete all existing demo boards
    const existingBoards = await db.collection('boards')
      .where('userId', '==', null)
      .get();
    
    if (!existingBoards.empty) {
      console.log(`   Found ${existingBoards.size} existing demo boards`);
      const deletePromises = existingBoards.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      console.log('   ✅ Successfully deleted all existing demo boards');
    } else {
      console.log('   ℹ️  No existing demo boards found');
    }
    
    console.log('\n✨ Step 2: Creating new demo boards with validated connections...');
    
    // Create new demo boards
    for (const board of boards) {
      const boardData = {
        name: board.name,
        userId: null, // Demo boards have null userId
        content: board.content,
        savedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('boards').add(boardData);
      console.log(`   ✅ Created: "${board.name}" (${board.content.connections.length} connections, ${board.content.items.length} items)`);
    }

    console.log(`\n🎉 Successfully created ${boards.length} complex demo boards with validated connections!`);
    console.log('   Each board has logical, hierarchical connections based on context and proximity.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating demo boards:', error);
    process.exit(1);
  }
};

// Run the script
createDemoBoards();

