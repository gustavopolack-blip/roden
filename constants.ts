
import { Client, Project, Budget, Task, User, SupplierPayment, Supplier, BudgetStatus } from './types';

export const PAGE_PERMISSIONS = {
  dashboard: ['administrador'],
  clients: ['administrador'],
  projects: ['administrador', 'gerente_taller', 'operario_taller'],
  estimator: ['administrador'],
  production: ['administrador', 'gerente_taller', 'operario_taller'],
  tasks: ['administrador', 'gerente_taller', 'operario_taller'],
  archive: ['administrador'],
  reports: ['administrador', 'gerente_taller', 'operario_taller'],
  budgets: ['administrador'],
  suppliers: ['administrador', 'gerente_taller'],
  ai: ['administrador'],
  staff: ['administrador'],
  settings: ['administrador']
};

export const MOCK_USER_ADMIN: User = {
  id: 'u1',
  name: 'Admin rødën',
  email: 'admin@roden.com',
  phone: '+54 9 11 5555 1234',
  role: 'administrador',
  status: 'ACTIVE',
  joinedDate: '2023-01-15',
  avatarInitials: 'AD'
};

export const MOCK_USER_RESTRICTED: User = {
  id: 'u2',
  name: 'Juan Taller',
  email: 'taller@roden.com',
  phone: '+54 9 11 5555 5678',
  role: 'operario_taller',
  status: 'ACTIVE',
  joinedDate: '2023-03-10',
  avatarInitials: 'JT'
};

export const MOCK_USER_MANAGER: User = {
  id: 'u5',
  name: 'Roberto Jefe',
  email: 'jefe@roden.com',
  phone: '+54 9 11 5555 9999',
  role: 'gerente_taller',
  status: 'ACTIVE',
  joinedDate: '2022-11-01',
  avatarInitials: 'RJ'
};

export const MOCK_USERS_LIST: User[] = [
    MOCK_USER_ADMIN,
    MOCK_USER_RESTRICTED,
    MOCK_USER_MANAGER,
    {
        id: 'u3',
        name: 'Ana Diseño',
        email: 'ana@roden.com',
        phone: '+54 9 11 5555 9876',
        role: 'administrador', 
        status: 'ACTIVE',
        joinedDate: '2023-06-22',
        avatarInitials: 'AN'
    },
    {
        id: 'u4',
        name: 'Carlos Montaje',
        email: 'carlos@roden.com',
        phone: '+54 9 11 5555 4321',
        role: 'operario_taller',
        status: 'INACTIVE',
        joinedDate: '2024-01-05',
        avatarInitials: 'CM'
    }
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Sofía Martínez',
    phone: '+54 9 11 1234 5678',
    address: 'Av. Libertador 4500, Palermo',
    status: 'ACTIVE',
    type: 'INDIVIDUAL',
    joinedDate: '2023-11-15',
    origin: 'SOCIAL_MEDIA',
    tags: ['VIP', 'Minimalista'],
    notes: 'Le gustan los acabados negro mate. Presupuesto alto.',
    totalValue: 15000
  },
  {
    id: 'c2',
    name: 'Estudio Arquitectura BLK',
    phone: '+54 9 11 8765 4321',
    address: 'Costa Rica 5000, Soho',
    status: 'ACTIVE',
    type: 'COMPANY',
    joinedDate: '2024-02-01',
    origin: 'REFERRAL',
    tags: ['Socio', 'Recurrente'],
    notes: 'Necesita entregas rápidas de renders.',
    totalValue: 45000
  },
  {
    id: 'c3',
    name: 'Lucas & Ana',
    phone: '+54 9 11 9999 8888',
    address: 'Nordelta, Tigre',
    status: 'LEAD',
    type: 'INDIVIDUAL',
    joinedDate: '2024-05-10',
    origin: 'WEBSITE',
    tags: ['Referido'],
    notes: 'Interesados en remodelación completa de cocina.',
    totalValue: 0
  },
  {
    id: 'c4',
    name: 'Julieta Rossi',
    phone: '+54 9 11 2222 3333',
    address: 'Juramento 2000, Belgrano',
    status: 'ACTIVE',
    type: 'INDIVIDUAL',
    joinedDate: '2023-12-05',
    origin: 'ORGANIC',
    tags: ['Nuevo'],
    notes: 'Busca diseño de vestidor.',
    totalValue: 12000
  },
  {
    id: 'c5',
    name: 'Constructora Delta',
    phone: '+54 9 11 4444 5555',
    address: 'Av. Santa Fe 3000, Recoleta',
    status: 'ACTIVE',
    type: 'COMPANY',
    joinedDate: '2024-01-15',
    origin: 'REFERRAL',
    tags: ['Corporativo'],
    notes: 'Proyectos de edificios residenciales.',
    totalValue: 85000
  },
  {
    id: 'c6',
    name: 'Martín Gómez',
    phone: '+54 9 11 6666 7777',
    address: 'Gorriti 4000, Palermo Soho',
    status: 'LEAD',
    type: 'INDIVIDUAL',
    joinedDate: '2024-03-20',
    origin: 'SOCIAL_MEDIA',
    tags: ['Potencial'],
    notes: 'Consulta por muebles de oficina.',
    totalValue: 0
  },
  {
    id: 'c7',
    name: 'Elena Vázquez',
    phone: '+54 9 11 8888 9999',
    address: 'Alvear 1500, Martínez',
    status: 'ACTIVE',
    type: 'INDIVIDUAL',
    joinedDate: '2023-10-10',
    origin: 'WEBSITE',
    tags: ['Premium'],
    notes: 'Remodelación de living.',
    totalValue: 25000
  },
  {
    id: 'c8',
    name: 'Inmobiliaria Norte',
    phone: '+54 9 11 1111 2222',
    address: 'Maipú 500, Vicente López',
    status: 'ACTIVE',
    type: 'COMPANY',
    joinedDate: '2024-02-10',
    origin: 'REFERRAL',
    tags: ['Recurrente'],
    notes: 'Muebles para departamentos de muestra.',
    totalValue: 32000
  },
  {
    id: 'c9',
    name: 'Ricardo Pérez',
    phone: '+54 9 11 3333 4444',
    address: 'Donado 1800, Villa Urquiza',
    status: 'LEAD',
    type: 'INDIVIDUAL',
    joinedDate: '2024-04-05',
    origin: 'ORGANIC',
    tags: ['Nuevo'],
    notes: 'Interesado en racks de TV.',
    totalValue: 0
  },
  {
    id: 'c10',
    name: 'Valentina Soler',
    phone: '+54 9 11 5555 6666',
    address: 'Castex 3200, Palermo Chico',
    status: 'ACTIVE',
    type: 'INDIVIDUAL',
    joinedDate: '2023-09-15',
    origin: 'SOCIAL_MEDIA',
    tags: ['VIP'],
    notes: 'Diseño de interiores completo.',
    totalValue: 55000
  },
  {
    id: 'c11',
    name: 'Estudio G&A',
    phone: '+54 9 11 7777 8888',
    address: 'Callao 1200, Recoleta',
    status: 'ACTIVE',
    type: 'COMPANY',
    joinedDate: '2024-01-20',
    origin: 'WEBSITE',
    tags: ['Arquitectos'],
    notes: 'Colaboración en proyectos de cocina.',
    totalValue: 28000
  },
  {
    id: 'c12',
    name: 'Andrés Morales',
    phone: '+54 9 11 9999 0000',
    address: 'Av. de los Lagos, Nordelta',
    status: 'LEAD',
    type: 'INDIVIDUAL',
    joinedDate: '2024-05-15',
    origin: 'REFERRAL',
    tags: ['Nuevo'],
    notes: 'Consulta por biblioteca a medida.',
    totalValue: 0
  },
  {
    id: 'c13',
    name: 'Paula Fernández',
    phone: '+54 9 11 1212 3434',
    address: 'Sucre 1500, Belgrano R',
    status: 'ACTIVE',
    type: 'INDIVIDUAL',
    joinedDate: '2023-11-01',
    origin: 'ORGANIC',
    tags: ['Fiel'],
    notes: 'Muebles de dormitorio infantil.',
    totalValue: 18000
  },
  {
    id: 'c14',
    name: 'Desarrollos Urbanos',
    phone: '+54 9 11 5656 7878',
    address: 'Della Paolera 200, Retiro',
    status: 'ACTIVE',
    type: 'COMPANY',
    joinedDate: '2024-03-01',
    origin: 'WEBSITE',
    tags: ['Gran Escala'],
    notes: 'Equipamiento para oficinas corporativas.',
    totalValue: 120000
  },
  {
    id: 'c15',
    name: 'Mariana López',
    phone: '+54 9 11 9090 1212',
    address: 'Echeverría 3000, Belgrano',
    status: 'LEAD',
    type: 'INDIVIDUAL',
    joinedDate: '2024-05-20',
    origin: 'SOCIAL_MEDIA',
    tags: ['Nuevo'],
    notes: 'Interesada en remodelación de baño.',
    totalValue: 0
  }
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    clientId: 'c1',
    title: 'Vestidor Principal & Suite',
    status: 'PRODUCTION',
    productionStep: 'FABRICACION',
    stepDates: {
        'ANTICIPO_PLANOS': '10/05',
        'COMPRA_MATERIALES': '15/05',
        'FABRICACION': '20/05'
    },
    startDate: '2024-05-01',
    deadline: '2024-06-15',
    progress: 50,
    budget: 8500,
    tasksTotal: 12,
    tasksCompleted: 8,
    driveFolderUrl: 'https://drive.google.com/drive/u/0/my-drive',
    productionNotes: [
        { id: 'n1', content: 'Verificar medidas finales en obra antes de corte.', date: '2024-05-01 10:00', author: 'Ana Diseño' },
        { id: 'n2', content: 'Cliente solicitó acabado mate especial en frentes.', date: '2024-05-05 14:30', author: 'Admin rødën' }
    ]
  },
  {
    id: 'p2',
    clientId: 'c1',
    title: 'Biblioteca Living',
    status: 'PROPOSAL',
    productionStep: 'ANTICIPO_PLANOS',
    stepDates: {
        'ANTICIPO_PLANOS': '18/05'
    },
    startDate: '2024-05-15',
    deadline: '2024-07-01',
    progress: 20,
    budget: 3200,
    tasksTotal: 5,
    tasksCompleted: 1,
    driveFolderUrl: 'https://drive.google.com/drive/u/0/my-drive',
    productionNotes: []
  },
  {
    id: 'p3',
    clientId: 'c2',
    title: 'Recepción Oficinas',
    status: 'READY',
    productionStep: 'LISTO',
    stepDates: {
        'ANTICIPO_PLANOS': '01/05',
        'COMPRA_MATERIALES': '05/05',
        'FABRICACION': '10/05',
        'LUSTRE': '20/05',
        'PREPARACION': '25/05',
        'LISTO': '28/05'
    },
    startDate: '2024-04-20',
    deadline: '2024-05-30',
    progress: 100,
    budget: 12000,
    tasksTotal: 20,
    tasksCompleted: 20,
    driveFolderUrl: 'https://drive.google.com/drive/u/0/my-drive',
    productionNotes: [
        { id: 'n3', content: 'Todo listo para instalar el lunes.', date: '2024-05-28 09:00', author: 'Roberto Jefe' }
    ]
  },
  {
    id: 'p4',
    clientId: 'c3',
    title: 'Cocina Integral',
    status: 'QUOTING',
    productionStep: 'ANTICIPO_PLANOS',
    stepDates: {
        'ANTICIPO_PLANOS': '22/05'
    },
    startDate: '2024-05-20',
    deadline: '2024-06-20',
    progress: 10,
    budget: 0,
    tasksTotal: 8,
    tasksCompleted: 0
  },
  {
    id: 'p5',
    clientId: 'c2',
    title: 'Mueble TV (Archivado)',
    status: 'COMPLETED',
    productionStep: 'LISTO',
    startDate: '2024-01-10',
    deadline: '2024-02-28',
    progress: 100,
    budget: 4500,
    tasksTotal: 10,
    tasksCompleted: 10,
    archiveReason: 'Proyecto finalizado con éxito. Cliente muy conforme.'
  },
  {
    id: 'p6',
    clientId: 'c3',
    title: 'Vanitory Principal',
    status: 'CANCELLED',
    startDate: '2024-02-15',
    deadline: '2024-03-01',
    progress: 0,
    budget: 1200,
    tasksTotal: 2,
    tasksCompleted: 0,
    archiveReason: 'El cliente consideró que el presupuesto excedía sus expectativas. Optaron por un mueble estándar.'
  }
];

export const MOCK_BUDGETS: Budget[] = [
  {
    id: 'b1',
    projectId: 'p1',
    total: 8500,
    downPayment: 4250,
    downPaymentDate: '2024-05-01',
    balance: 4250,
    balanceDate: '2024-06-15',
    status: BudgetStatus.APPROVED,
    version: 2,
    lastModified: '2024-04-10',
    items: [
      { id: 'bi1', description: 'Placas Melamina Egger', quantity: 15, unitPrice: 200, category: 'MATERIAL' },
      { id: 'bi2', description: 'Herrajes Blum', quantity: 1, unitPrice: 1500, category: 'MATERIAL' },
      { id: 'bi3', description: 'Mano de obra fabricación', quantity: 40, unitPrice: 50, category: 'LABOR' }
    ]
  },
  {
    id: 'b2',
    projectId: 'p4',
    total: 15400,
    downPayment: 0,
    balance: 15400,
    status: BudgetStatus.SENT,
    version: 1,
    lastModified: '2024-05-18',
    items: [
      { id: 'bi4', description: 'Mesada Neolith', quantity: 1, unitPrice: 4000, category: 'MATERIAL' }
    ]
  },
  {
    id: 'b3',
    projectId: 'p3',
    total: 12000,
    downPayment: 6000,
    downPaymentDate: '2024-04-25',
    balance: 6000,
    balanceDate: '2024-05-30',
    status: BudgetStatus.APPROVED,
    version: 1,
    lastModified: '2024-04-25',
    items: []
  }
];

export const MOCK_SUPPLIERS: Supplier[] = [
    { id: 's1', name: 'Maderera del Norte', contactName: 'Jorge Gómez', phone: '11-4444-5555', email: 'ventas@madereranorte.com', category: 'Placas y Madera' },
    { id: 's2', name: 'Herrajes Pro', contactName: 'María López', phone: '11-6666-7777', email: 'pedidos@herrajespro.com', category: 'Herrajes' },
    { id: 's3', name: 'Neolith Oficial', contactName: 'Roberto Piedra', phone: '11-8888-9999', email: 'roberto@neolith.com', category: 'Marmolería' }
];

export const MOCK_SUPPLIER_PAYMENTS: SupplierPayment[] = [
    {
        id: 'sp1',
        providerName: 'Maderera del Norte',
        projectId: 'p1', // Linked to Vestidor
        concept: 'Placas Melamina (Vestidor P1)',
        downPayment: 150000,
        downPaymentDate: '2024-05-02',
        balance: 150000,
        balanceDate: '2024-05-15',
        totalAmount: 300000,
        status: 'PENDING'
    },
    {
        id: 'sp2',
        providerName: 'Herrajes Pro',
        projectId: 'p3', // Linked to Oficinas
        concept: 'Guías Blum x 20',
        downPayment: 500000,
        downPaymentDate: '2024-05-10',
        balance: 0,
        balanceDate: '-',
        totalAmount: 500000,
        status: 'PAID'
    }
];

export const MOCK_TASKS: Task[] = [
  { id: 't1', title: 'Comprar Correderas Telescópicas', assignee: 'Juan Taller', createdBy: 'Admin rødën', dueDate: '2024-05-25', completed: false, priority: 'HIGH', projectId: 'p1' },
  { id: 't2', title: 'Enviar Renders Finales', assignee: 'Admin rødën', createdBy: 'Roberto Jefe', dueDate: '2024-05-22', completed: true, priority: 'MEDIUM', projectId: 'p2' },
  { id: 't3', title: 'Llamar a proveedor de granito', assignee: 'Admin rødën', createdBy: 'Ana Diseño', dueDate: '2024-05-26', completed: false, priority: 'LOW', projectId: 'p4' },
  { id: 't4', title: 'Embalar muebles recepción', assignee: 'Juan Taller', createdBy: 'Roberto Jefe', dueDate: '2024-05-28', completed: false, priority: 'HIGH', projectId: 'p3' },
];
