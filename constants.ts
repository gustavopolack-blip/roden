
import { Client, Project, Budget, Task, User, SupplierPayment, Supplier } from './types';

export const MOCK_USER_ADMIN: User = {
  id: 'u1',
  name: 'Admin rødën',
  email: 'admin@roden.com',
  phone: '+54 9 11 5555 1234',
  role: 'ADMIN',
  status: 'ACTIVE',
  joinedDate: '2023-01-15',
  avatarInitials: 'AD'
};

export const MOCK_USER_RESTRICTED: User = {
  id: 'u2',
  name: 'Juan Taller',
  email: 'taller@roden.com',
  phone: '+54 9 11 5555 5678',
  role: 'USER',
  status: 'ACTIVE',
  joinedDate: '2023-03-10',
  avatarInitials: 'JT'
};

export const MOCK_USER_MANAGER: User = {
  id: 'u5',
  name: 'Roberto Jefe',
  email: 'jefe@roden.com',
  phone: '+54 9 11 5555 9999',
  role: 'WORKSHOP_MANAGER',
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
        role: 'ADMIN', 
        status: 'ACTIVE',
        joinedDate: '2023-06-22',
        avatarInitials: 'AN'
    },
    {
        id: 'u4',
        name: 'Carlos Montaje',
        email: 'carlos@roden.com',
        phone: '+54 9 11 5555 4321',
        role: 'USER',
        status: 'INACTIVE',
        joinedDate: '2024-01-05',
        avatarInitials: 'CM'
    }
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Sofía Martínez',
    email: 'sofia.m@example.com',
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
    email: 'contacto@blk.arch',
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
    email: 'lucas.ana@example.com',
    phone: '+54 9 11 9999 8888',
    address: 'Nordelta, Tigre',
    status: 'LEAD',
    type: 'INDIVIDUAL',
    joinedDate: '2024-05-10',
    origin: 'WEBSITE',
    tags: ['Referido'],
    notes: 'Interesados en remodelación completa de cocina.',
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
    tasksCompleted: 10
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
    status: 'APPROVED',
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
    status: 'SENT',
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
    status: 'APPROVED',
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
  { id: 't1', title: 'Comprar Correderas Telescópicas', assignee: 'Juan Taller', dueDate: '2024-05-25', completed: false, priority: 'HIGH', projectId: 'p1' },
  { id: 't2', title: 'Enviar Renders Finales', assignee: 'Admin rødën', dueDate: '2024-05-22', completed: true, priority: 'MEDIUM', projectId: 'p2' },
  { id: 't3', title: 'Llamar a proveedor de granito', assignee: 'Admin rødën', dueDate: '2024-05-26', completed: false, priority: 'LOW', projectId: 'p4' },
  { id: 't4', title: 'Embalar muebles recepción', assignee: 'Juan Taller', dueDate: '2024-05-28', completed: false, priority: 'HIGH', projectId: 'p3' },
];
