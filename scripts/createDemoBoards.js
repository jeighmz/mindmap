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

// Create demo boards
const createDemoBoards = async () => {
  const boards = [
    {
      name: 'Project Planning Mind Map',
      content: {
        items: [
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 400, y: 200 },
            width: 200,
            height: 150,
            text: 'Project Planning',
            title: 'Project Planning'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 200, y: 400 },
            width: 180,
            height: 140,
            text: 'Research & Discovery\n• User interviews\n• Market analysis\n• Competitor research',
            title: 'Research & Discovery'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 600, y: 400 },
            width: 180,
            height: 140,
            text: 'Design Phase\n• Wireframes\n• Prototypes\n• User testing',
            title: 'Design Phase'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 400, y: 600 },
            width: 180,
            height: 140,
            text: 'Development\n• Frontend\n• Backend\n• Testing',
            title: 'Development'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 800, y: 600 },
            width: 180,
            height: 140,
            text: 'Launch\n• Deployment\n• Marketing\n• Monitoring',
            title: 'Launch'
          }
        ],
        connections: [
          {
            id: `conn-1`,
            from: null,
            to: null,
            color: '#2196F3',
            strokeWidth: 2,
            lineType: 'straight',
            lineDesign: 'curved',
            arrowDirection: '->',
            arrowHeadStyle: 'medium'
          }
        ],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Learning Roadmap',
      content: {
        items: [
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 500, y: 250 },
            width: 220,
            height: 160,
            text: 'Learning Roadmap',
            title: 'Learning Roadmap'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 200, y: 450 },
            width: 200,
            height: 150,
            text: 'Fundamentals\n• HTML/CSS\n• JavaScript\n• Git basics',
            title: 'Fundamentals'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 500, y: 450 },
            width: 200,
            height: 150,
            text: 'Frontend\n• React\n• Vue.js\n• TypeScript',
            title: 'Frontend'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 800, y: 450 },
            width: 200,
            height: 150,
            text: 'Backend\n• Node.js\n• Databases\n• APIs',
            title: 'Backend'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 350, y: 650 },
            width: 200,
            height: 150,
            text: 'DevOps\n• Docker\n• CI/CD\n• Cloud',
            title: 'DevOps'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 650, y: 650 },
            width: 200,
            height: 150,
            text: 'Advanced\n• Microservices\n• Architecture\n• Patterns',
            title: 'Advanced'
          }
        ],
        connections: [
          {
            id: `conn-1`,
            from: null,
            to: null,
            color: '#4CAF50',
            strokeWidth: 2,
            lineType: 'straight',
            lineDesign: 'curved',
            arrowDirection: '->',
            arrowHeadStyle: 'medium'
          }
        ],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Business Strategy',
      content: {
        items: [
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 450, y: 200 },
            width: 200,
            height: 150,
            text: 'Business Strategy',
            title: 'Business Strategy'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 150, y: 400 },
            width: 180,
            height: 140,
            text: 'Vision\n• Long-term goals\n• Mission statement',
            title: 'Vision'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 400, y: 400 },
            width: 180,
            height: 140,
            text: 'Market Analysis\n• Target audience\n• Competition\n• Trends',
            title: 'Market Analysis'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 650, y: 400 },
            width: 180,
            height: 140,
            text: 'Value Proposition\n• Unique selling points\n• Customer benefits',
            title: 'Value Proposition'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 300, y: 600 },
            width: 180,
            height: 140,
            text: 'Marketing\n• Channels\n• Campaigns\n• Branding',
            title: 'Marketing'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 550, y: 600 },
            width: 180,
            height: 140,
            text: 'Operations\n• Processes\n• Resources\n• Timeline',
            title: 'Operations'
          }
        ],
        connections: [
          {
            id: `conn-1`,
            from: null,
            to: null,
            color: '#FF9800',
            strokeWidth: 2,
            lineType: 'straight',
            lineDesign: 'curved',
            arrowDirection: '->',
            arrowHeadStyle: 'medium'
          }
        ],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Product Features',
      content: {
        items: [
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 400, y: 180 },
            width: 200,
            height: 150,
            text: 'Product Features',
            title: 'Product Features'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 100, y: 380 },
            width: 170,
            height: 130,
            text: 'Core Features\n• Essential functionality',
            title: 'Core Features'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 300, y: 380 },
            width: 170,
            height: 130,
            text: 'User Experience\n• Intuitive design\n• Easy navigation',
            title: 'User Experience'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 500, y: 380 },
            width: 170,
            height: 130,
            text: 'Performance\n• Fast loading\n• Optimization',
            title: 'Performance'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 700, y: 380 },
            width: 170,
            height: 130,
            text: 'Security\n• Data protection\n• Privacy',
            title: 'Security'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 200, y: 560 },
            width: 170,
            height: 130,
            text: 'Integration\n• APIs\n• Third-party tools',
            title: 'Integration'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 400, y: 560 },
            width: 170,
            height: 130,
            text: 'Mobile\n• Responsive design\n• Native apps',
            title: 'Mobile'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 600, y: 560 },
            width: 170,
            height: 130,
            text: 'Analytics\n• User tracking\n• Insights',
            title: 'Analytics'
          }
        ],
        connections: [
          {
            id: `conn-1`,
            from: null,
            to: null,
            color: '#9C27B0',
            strokeWidth: 2,
            lineType: 'straight',
            lineDesign: 'curved',
            arrowDirection: '->',
            arrowHeadStyle: 'medium'
          }
        ],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    },
    {
      name: 'Team Collaboration',
      content: {
        items: [
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 450, y: 200 },
            width: 200,
            height: 150,
            text: 'Team Collaboration',
            title: 'Team Collaboration'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 150, y: 400 },
            width: 180,
            height: 140,
            text: 'Communication\n• Daily standups\n• Slack channels\n• Meetings',
            title: 'Communication'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 400, y: 400 },
            width: 180,
            height: 140,
            text: 'Tools\n• Project management\n• Version control\n• Documentation',
            title: 'Tools'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 650, y: 400 },
            width: 180,
            height: 140,
            text: 'Workflow\n• Agile methodology\n• Sprints\n• Reviews',
            title: 'Workflow'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 275, y: 600 },
            width: 180,
            height: 140,
            text: 'Roles\n• Product Owner\n• Developer\n• Designer',
            title: 'Roles'
          },
          {
            id: generateId(),
            type: 'sticky',
            position: { x: 525, y: 600 },
            width: 180,
            height: 140,
            text: 'Goals\n• Objectives\n• Metrics\n• Success criteria',
            title: 'Goals'
          }
        ],
        connections: [
          {
            id: `conn-1`,
            from: null,
            to: null,
            color: '#F44336',
            strokeWidth: 2,
            lineType: 'straight',
            lineDesign: 'curved',
            arrowDirection: '->',
            arrowHeadStyle: 'medium'
          }
        ],
        scale: 1,
        panOffset: { x: 0, y: 0 }
      }
    }
  ];

  // Fix connections to use actual item IDs
  boards.forEach((board, boardIndex) => {
    const items = board.content.items;
    const centerItem = items[0]; // First item is the center
    const defaultColor = board.content.connections[0]?.color || '#2196F3';
    
    // Create connections from center to all other items
    const connections = items.slice(1).map((item, index) => ({
      id: `conn-${boardIndex}-${index + 1}`,
      from: centerItem.id,
      to: item.id,
      color: defaultColor,
      strokeWidth: 2,
      lineType: 'straight',
      lineDesign: 'curved',
      arrowDirection: '->',
      arrowHeadStyle: 'medium'
    }));
    
    board.content.connections = connections;
  });

  try {
    console.log('Creating demo boards...');
    
    for (const board of boards) {
      const boardData = {
        name: board.name,
        userId: null, // Demo boards have null userId
        content: board.content,
        savedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('boards').add(boardData);
      console.log(`✅ Created demo board: "${board.name}" (ID: ${docRef.id})`);
    }

    console.log(`\n✨ Successfully created ${boards.length} demo boards!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating demo boards:', error);
    process.exit(1);
  }
};

// Run the script
createDemoBoards();

