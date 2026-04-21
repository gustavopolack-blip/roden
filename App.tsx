import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Clients from './pages/Clients';
import AIAssistant from './pages/AIAssistant';
import Budgets from './pages/Budgets';
import Production from './pages/Production';
import Tasks from './pages/Tasks';
import Staff from './pages/Staff';
import Settings from './pages/Settings';
import SupplierPayments from './pages/SupplierPayments';
import Reports from './pages/Reports';
import Archive from './pages/Archive';
import Login from './pages/Login';

// Code splitting: CostEstimator es el componente mas pesado (5000+ lineas)
const CostEstimator = lazy(() => import('./pages/CostEstimator'));

import {
  MOCK_USER_ADMIN,
  MOCK_CLIENTS,
  MOCK_PROJECTS,
  MOCK_BUDGETS,
  MOCK_SUPPLIERS,
  MOCK_SUPPLIER_PAYMENTS,
  MOCK_TASKS,
  PAGE_PERMISSIONS
} from './constants';

import {
  BusinessData,
  Client,
  Project,
  Budget,
  Task,
  User,
  UserRole,
  SupplierPayment,
  Report,
  Supplier,
  SavedEstimate,
  ProductionOrder,
  ProjectDossier,
  Estimate
} from './types';

import { supabase } from './services/supabaseClient';
import {
  projectFromDB, projectToDB,
  userFromDB, userToDB,
  taskFromDB, taskToDB,
  clientFromDB, clientToDB,
  supplierPaymentFromDB, supplierPaymentToDB,
  supplierFromDB, supplierToDB,
  reportFromDB, reportToDB,
  budgetFromDB, budgetToDB
} from './utils/dataMapper';
import { Loader2, Menu, ShieldAlert, RefreshCw, X, ShieldCheck } from 'lucide-react';
import NotificationBell from './components/NotificationBell';
import BottomNav from './components/BottomNav';
import { emitNotification } from './utils/notificationHelpers';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);

  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isWakingUpDb, setIsWakingUpDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── Dark mode ──────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem('roden-theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      try { localStorage.setItem('roden-theme', 'dark'); } catch {}
    } else {
      root.classList.remove('dark');
      try { localStorage.setItem('roden-theme', 'light'); } catch {}
    }
  }, [isDark]);

  const toggleDark = () => setIsDark(prev => !prev);
  // ─────────────────────────────────────────────────────────────────

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const isFetchingProfileRef = useRef<boolean>(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);

  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showEmergencyButton, setShowEmergencyButton] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isProfileLoading) {
      timer = setTimeout(() => setShowEmergencyButton(true), 10000);
    } else {
      setShowEmergencyButton(false);
    }
    return () => clearTimeout(timer);
  }, [isProfileLoading]);

  const loadMockData = () => {
    console.log("[loadMockData] Loading static mock data...");
    setClients(MOCK_CLIENTS);
    setProjects(MOCK_PROJECTS);
    setSuppliers(MOCK_SUPPLIERS);
    setSupplierPayments(MOCK_SUPPLIER_PAYMENTS);
    setTasks(MOCK_TASKS);
    // Para usuarios, usamos el admin mock y el actual
    setUsers([MOCK_USER_ADMIN, currentUserRef.current].filter(Boolean) as User[]);
    
    setDbError("Estás viendo DATOS DE PRUEBA porque la base de datos no responde. Los cambios no se guardarán.");
  };

  const fetchData = async () => {
    console.log("[fetchData] Started.");
    setIsSyncing(true);
    try {
      // Use the session we already have instead of calling getSession again
      const currentSession = session || (await supabase.auth.getSession()).data.session;
      
      if (!currentSession) {
        console.warn("[fetchData] No hay sesión activa, abortando carga de datos.");
        setIsSyncing(false);
        return;
      }

      console.log("[fetchData] Awaiting Promise.allSettled...");
      
      const fetchPromise = Promise.allSettled([
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*'),
        // supabase.from('budgets').select('*'), // Budgets ahora es para Estimador, no Finanzas
        supabase.from('suppliers').select('*'),
        supabase.from('supplier_payments').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('users').select('*'),
        supabase.from('reports').select('*'),
        supabase.from('production_orders').select('*'),
        supabase.from('saved_estimates').select('*'),
        supabase.from('estimates').select('*'),
        supabase.from('price_lists').select('*')
      ]);

      const wakingUpTimeout = setTimeout(() => {
        setIsWakingUpDb(true);
      }, 5000);

      // Create a timeout promise that rejects after 60 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("fetchData timeout")), 60000)
      );

      // Race the fetch against the timeout
      const results = await Promise.race([fetchPromise, timeoutPromise]) as PromiseSettledResult<any>[];
      
      clearTimeout(wakingUpTimeout);
      setIsWakingUpDb(false);
      
      console.log("[fetchData] Promise.allSettled completed.");

      // Check if results is actually an array (it should be if fetchPromise won)
      if (!Array.isArray(results)) {
          throw new Error("Unexpected result from Promise.race");
      }

      const [cRes, pRes, sRes, spRes, tRes, uRes, rRes, poRes, seRes, eRes, plRes] = results;

      // Log errors for debugging
      let hasPermissionError = false;
      let hasMissingTableError = false;
      results.forEach((res, index) => {
        if (res.status === 'rejected') {
          console.error(`[fetchData] Table fetch ${index} failed:`, res.reason);
        } else if (res.status === 'fulfilled' && res.value.error) {
          console.error(`[fetchData] Table fetch ${index} returned Supabase error:`, res.value.error);
          if (res.value.error.message?.includes('permission denied')) {
            hasPermissionError = true;
          }
          if (res.value.error.message?.includes('relation') && res.value.error.message?.includes('does not exist')) {
            hasMissingTableError = true;
          }
        }
      });

      if (hasPermissionError) {
        setDbError('Error de permisos en Supabase. Por favor, ejecuta el script "migration_fix_all.sql" en el SQL Editor de tu proyecto de Supabase para habilitar el acceso a los datos.');
      } else if (hasMissingTableError) {
        setDbError('Faltan tablas en la base de datos. Por favor, ejecuta el script "db_schema.sql" y luego "migration_fix_all.sql" en el SQL Editor de Supabase.');
      }

      if (cRes.status === 'fulfilled' && cRes.value.data) setClients(cRes.value.data.map(clientFromDB));
      if (pRes.status === 'fulfilled' && pRes.value.data) setProjects(pRes.value.data.map(projectFromDB));
      // if (bRes.status === 'fulfilled' && bRes.value.data) setBudgets(bRes.value.data.map(budgetFromDB)); // Budgets ahora es Estimador
      if (sRes.status === 'fulfilled' && sRes.value.data) setSuppliers(sRes.value.data.map(supplierFromDB));
      if (spRes.status === 'fulfilled' && spRes.value.data) setSupplierPayments(spRes.value.data.map(supplierPaymentFromDB));
      if (tRes.status === 'fulfilled' && tRes.value.data) setTasks(tRes.value.data.map(taskFromDB));
      if (uRes.status === 'fulfilled' && uRes.value.data) setUsers(uRes.value.data.map(userFromDB));
      if (rRes.status === 'fulfilled' && rRes.value.data) setReports(rRes.value.data.map(reportFromDB));
      if (poRes.status === 'fulfilled' && poRes.value.data) {
        const ordersRaw = poRes.value.data;
        setProductionOrders(ordersRaw.map((o: any) => {
          const linkedProjId = o.linkedProjectId || o.linked_project_id || o.project_id || null;
          // Resolver nombre del proyecto si clientName está vacío
          const resolvedClientName = o.clientName
            || (linkedProjId ? (projects.find((p: any) => p.id === linkedProjId)?.title || '') : '')
            || o.customProjectName
            || '';
          return {
            ...o,
            orderNumber:           o.orderNumber    || o.order_number    || '',
            startDate:             o.startDate      || o.start_date      || '',
            estimatedDeliveryDate: o.estimatedDeliveryDate || o.delivery_date || '',
            assignedOperators:     Array.isArray(o.assignedOperators) ? o.assignedOperators
                                   : Array.isArray(o.assigned_operators) ? o.assigned_operators
                                   : (typeof o.assignedOperators === 'string' && o.assignedOperators) ? o.assignedOperators.split(',').map((s: string) => s.trim())
                                   : (typeof o.assigned_operators === 'string' && o.assigned_operators) ? o.assigned_operators.split(',').map((s: string) => s.trim())
                                   : [],
            clientName:            resolvedClientName,
            itemDescription:       o.itemDescription || '',
            linkedProjectId:       linkedProjId,
          };
        }));
      }
      if (seRes.status === 'fulfilled' && seRes.value.data) setSavedEstimates(seRes.value.data);
      if (eRes.status === 'fulfilled' && eRes.value.data) {
        console.log('[fetchData] estimates raw:', eRes.value.data);
        setEstimates(eRes.value.data.map((e: any) => ({
          id:             e.id,
          projectId:      e.project_id      || null,
          priceListId:    e.price_list_id   || null,
          title:          e.title           || '',
          description:    e.description     || '',
          version:        e.version         || 1,
          status:         e.status          || '',
          totalAmount:    Number(e.total_amount)    || 0,
          downPayment:    Number(e.down_payment)    || 0,
          downPaymentDate:e.down_payment_date || '',
          balance:        Number(e.balance_amount)  || 0,
          balanceDate:    e.balance_date     || '',
          expirationDate: e.expiration_date  || '',
          createdAt:      e.created_at       || '',
          createdBy:      e.created_by       || '',
          currency:       e.currency         || 'ARS',
        })));
      }
      if (plRes.status === 'fulfilled' && plRes.value.data) setPriceLists(plRes.value.data);
    } catch (err: any) {
      console.error('[fetchData] Error cargando datos:', err);
      if (err.message?.includes('Timeout') || err.message?.includes('timeout')) {
        setDbError('La base de datos está pausada o no responde. Por favor, reintenta en un momento.');
      } else if (err.code === '42501' || (err.message && err.message.includes('permission denied'))) {
        setDbError('Error de Permisos (42501): Supabase está bloqueando el acceso. Ejecuta el script de "Reseteo Maestro" en el SQL Editor y luego pulsa el botón de abajo.');
      } else {
        setDbError('Error de conexión: ' + (err.message || 'Error desconocido al cargar datos.'));
      }
    } finally {
      console.log("[fetchData] Finally block reached.");
      setIsSyncing(false);
    }
  };

  const fetchUserProfile = async (session: Session) => {
    console.log("[fetchUserProfile] START for:", session.user.email);
    
    if (isFetchingProfileRef.current) {
        console.warn("[fetchUserProfile] Ya hay una petición en curso, abortando.");
        return;
    }
    
    isFetchingProfileRef.current = true;
    setIsProfileLoading(true);

    try {
      console.log("[fetchUserProfile] About to query users table...");
      
      // Añadimos un timeout a la consulta del perfil
      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Profile fetch timeout")), 10000)
      );

      const { data: userData, error: profileError } = await Promise.race([profilePromise, timeoutPromise]) as any;

      console.log("[fetchUserProfile] Query finished. Data:", userData, "Error:", profileError);

      if (profileError) throw profileError;

      if (userData) {
        const resolvedUser = userFromDB(userData);
        console.log("[fetchUserProfile] User found in DB:", resolvedUser.email, resolvedUser.role);
        currentUserRef.current = resolvedUser;
        setCurrentUser(resolvedUser);
        fetchData();
      } else {
        console.warn("[fetchUserProfile] User not found in profiles table. Using session-based admin fallback.");
        const fallback: User = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.email.split('@')[0].toUpperCase(),
          role: 'administrador',
          status: 'ACTIVE',
          joinedDate: new Date().toISOString(),
          avatarInitials: (session.user.email[0] || 'U').toUpperCase()
        };
        currentUserRef.current = fallback;
        setCurrentUser(fallback);
        fetchData();
      }
    } catch (err: any) {
      console.error('[fetchUserProfile] Error or Timeout:', err);
      // FALLBACK DE EMERGENCIA: Si la DB falla, entramos con los datos de la sesión
      console.log("[fetchUserProfile] Entering emergency mode due to DB failure.");
      const emergencyUser: User = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.email.split('@')[0].toUpperCase(),
        role: 'administrador',
        status: 'ACTIVE',
        joinedDate: new Date().toISOString(),
        avatarInitials: (session.user.email[0] || 'E').toUpperCase()
      };
      currentUserRef.current = emergencyUser;
      setCurrentUser(emergencyUser);
      fetchData();
    } finally {
      console.log("[fetchUserProfile] Finally block reached.");
      setIsAuthLoading(false);
      setIsProfileLoading(false);
      isFetchingProfileRef.current = false;
    }
  };

  const handleForceReset = async () => {
    console.log("[Force Reset] Starting instant reset...");
    // 1. Limpiar todo localmente
    localStorage.clear();
    sessionStorage.clear();
    setSession(null);
    setCurrentUser(null);
    currentUserRef.current = null;
    setIsAuthLoading(false);
    setIsProfileLoading(false);
    
    // 2. Intentar signOut sin esperar
    supabase.auth.signOut().catch(() => {});
    
    // 3. Recargar inmediatamente
    console.log("[Force Reset] Local state cleared, reloading page...");
    window.location.href = window.location.origin;
  };

  // ────────────────────────────────────────────────
  // Auth & Profile
  // ────────────────────────────────────────────────
  useEffect(() => {
    console.log("[Auth State Change Monitor]", {
      sessionEmail: session?.user?.email,
      userEmail: currentUser?.email,
      isAuthLoading,
      isProfileLoading
    });
  }, [session, currentUser, isAuthLoading, isProfileLoading]);

  useEffect(() => {
    let mounted = true;

    const globalSafetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn("[Global Safety Timeout] Unblocking UI after 60s");
        setIsAuthLoading(false);
        setIsProfileLoading(false);
      }
    }, 60000);

    const checkInitialSession = async () => {
      console.log("[checkInitialSession] Checking...");
      
      try {
        console.log("[checkInitialSession] Calling getSession()...");
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        console.log("[checkInitialSession] getSession() returned:", { initialSession, error });
        
        if (error) throw error;
        
        if (mounted) {
          if (initialSession) {
            console.log("[checkInitialSession] Session found:", initialSession.user.email);
            setSession(initialSession);
            if (!currentUserRef.current && !isFetchingProfileRef.current) {
              fetchUserProfile(initialSession);
            }
          } else {
            console.log("[checkInitialSession] No session.");
            setIsAuthLoading(false);
            setIsProfileLoading(false);
          }
        }
      } catch (e) {
        console.warn("[checkInitialSession] Error or Timeout (handled):", e);
        // If getSession fails/times out, we don't block the UI.
        // onAuthStateChange might still fire later if the network recovers.
        if (mounted) {
          setIsAuthLoading(false);
          setIsProfileLoading(false);
        }
      }
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      console.log(`[onAuthStateChange] Event: ${event}`, newSession?.user?.email);

      try {
        if (newSession) {
          // Actualizar sesión siempre que cambie
          setSession(newSession);

          // Guardar provider_token de Google para uso en Edge Functions (Google Calendar, etc.)
          // El token solo está disponible inmediatamente después del login con Google OAuth
          if ((newSession as any).provider_token) {
            sessionStorage.setItem('google_provider_token', (newSession as any).provider_token);
          }

          // Si ya tenemos este usuario cargado en el ref, solo nos aseguramos de que el estado coincida
          if (currentUserRef.current?.email === newSession.user.email) {
            console.log("[onAuthStateChange] User already loaded, ensuring state sync.");
            if (!currentUser) {
                setCurrentUser(currentUserRef.current);
            }
            setIsAuthLoading(false);
            setIsProfileLoading(false);
            return;
          }

          // Si es un usuario nuevo o no hay perfil cargado
          if (!isFetchingProfileRef.current) {
            await fetchUserProfile(newSession);
          }
        } else {
          console.log("[onAuthStateChange] No session, cleaning up.");
          setSession(null);
          setCurrentUser(null);
          currentUserRef.current = null;
          setIsAuthLoading(false);
          setIsProfileLoading(false);
          if (event === 'SIGNED_OUT') navigate('/', { replace: true });
        }
      } catch (e) {
        console.error("[onAuthStateChange] Error:", e);
        setIsAuthLoading(false);
        setIsProfileLoading(false);
      }
    });

    // Trigger initial session check manually if needed, 
    // but onAuthStateChange usually handles it.
    // We remove checkInitialSession() to prevent race conditions.

    return () => {
      mounted = false;
      clearTimeout(globalSafetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Redirigir a no-admins fuera del dashboard si intentan acceder a el
  useEffect(() => {
    if (currentUser && !isAuthLoading && currentUser.role !== 'administrador' && location.pathname === '/') {
      navigate('/projects', { replace: true });
    }
  }, [currentUser, isAuthLoading, location.pathname, navigate]);

  // ────────────────────────────────────────────────
  // CRUD Handlers
  // ────────────────────────────────────────────────

  const handleAddClient = async (newClient: Omit<Client, 'id'>) => {
    try {
      const { error } = await supabase.from('clients').insert(clientToDB(newClient));
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando cliente:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateClient = async (client: Client) => {
    try {
      const { error } = await supabase.from('clients').update(clientToDB(client)).eq('id', client.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando cliente:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    console.log("[handleDeleteClient] Attempting to delete client:", clientId);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) {
        console.error("[handleDeleteClient] Supabase error:", error);
        throw error;
      }
      console.log("[handleDeleteClient] Success, fetching data...");
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando cliente:', err);
      alert(`Error al eliminar cliente: ${err.message}`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    console.log("[handleDeleteProject] Attempting to delete project:", projectId);
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) {
        console.error("[handleDeleteProject] Supabase error:", error);
        throw error;
      }
      console.log("[handleDeleteProject] Success, fetching data...");
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando proyecto:', err);
      alert(`Error al eliminar proyecto: ${err.message}`);
    }
  };

  const handleAddProject = async (newProject: Omit<Project, 'id'>) => {
    try {
      const { error } = await supabase.from('projects').insert(projectToDB(newProject));
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando proyecto:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateProject = async (project: Project) => {
    try {
      if (project.status === 'COMPLETED') {
        const old = projects.find(p => p.id === project.id);
        if (old?.status !== 'COMPLETED') {
          const client = clients.find(c => c.id === project.clientId);
          const costs = supplierPayments
            .filter(sp => sp.projectId === project.id)
            .reduce((sum, sp) => sum + (sp.totalAmount || 0), 0);

          const dossier: ProjectDossier = {
            generatedAt: new Date().toISOString(),
            summary: `Obra finalizada: ${project.title}`,
            totalBudget: project.budget || 0,
            totalCost: costs,
            profitability: (project.budget || 0) - costs,
            keyDates: { start: project.startDate || '', end: new Date().toISOString().split('T')[0] },
            clientSnapshot: { name: client?.name || 'Desconocido' }
          };
          project.dossier = dossier;
        }
      }

      const { error } = await supabase.from('projects').update(projectToDB(project)).eq('id', project.id);
      if (error) throw error;

      // ── Notificaciones ──
      const oldProject = projects.find(p => p.id === project.id);
      if (oldProject) {
        if (oldProject.status !== project.status) {
          const statusLabels: Record<string, string> = {
            PROPOSAL: 'Propuesta', QUOTING: 'Cotizando', PRODUCTION: 'En Producción',
            READY: 'Listo para Entregar', COMPLETED: 'Completado', CANCELLED: 'Cancelado'
          };
          await emitNotification({
            type: 'project.status_changed',
            title: `Proyecto: ${project.title}`,
            body: `Estado: ${statusLabels[oldProject.status] || oldProject.status} → ${statusLabels[project.status] || project.status}`,
            entityId: project.id,
            entityType: 'project',
            entityPage: 'projects',
            fromUser: currentUser,
          });
        }
        if (oldProject.productionStep !== project.productionStep && project.productionStep) {
          await emitNotification({
            type: 'project.step_changed',
            title: `Taller: ${project.title}`,
            body: `Paso avanzó a: ${project.productionStep}`,
            entityId: project.id,
            entityType: 'workshop',
            entityPage: 'production',
            fromUser: currentUser,
          });
        }
        const oldNotesCount = (oldProject.productionNotes || []).length;
        const newNotesCount = (project.productionNotes || []).length;
        if (newNotesCount > oldNotesCount) {
          await emitNotification({
            type: 'project.note_added',
            title: `Nueva nota en: ${project.title}`,
            entityId: project.id,
            entityType: 'workshop',
            entityPage: 'production',
            fromUser: currentUser,
          });
        }
      }

      fetchData();
    } catch (err: any) {
      console.error('Error actualizando proyecto:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const estimateToDB = (e: Estimate) => ({
    id:                e.id,
    project_id:        e.projectId,
    price_list_id:     e.priceListId || null,
    title:             e.title,
    description:       e.description || '',
    version:           e.version || 1,
    status:            e.status,
    total_amount:      e.totalAmount ?? 0,
    currency:          'ARS',
    expiration_date:   e.expirationDate || null,
    created_by:        e.createdBy || null,
    down_payment:      e.downPayment ?? 0,
    down_payment_date: e.downPaymentDate || null,
    balance_amount:    e.balance ?? 0,
    balance_date:      e.balanceDate || null,
  });

  const handleAddEstimate = async (newEstimate: Estimate) => {
    try {
      const { error } = await supabase.from('estimates').insert(estimateToDB(newEstimate));
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando presupuesto:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateEstimate = async (estimate: Estimate) => {
    try {
      const { error } = await supabase.from('estimates').update(estimateToDB(estimate)).eq('id', estimate.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando presupuesto:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteEstimate = async (id: string) => {
    if (!window.confirm('¿Eliminar este presupuesto?')) return;
    try {
      const { error } = await supabase.from('estimates').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando presupuesto:', err);
      alert('No se pudo eliminar');
    }
  };

  const handleAddSupplier = async (newSupplier: Supplier) => {
    try {
      const { error } = await supabase.from('suppliers').insert(supplierToDB(newSupplier));
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando proveedor:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateSupplier = async (supplier: Supplier) => {
    try {
      const { error } = await supabase.from('suppliers').update(supplierToDB(supplier)).eq('id', supplier.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando proveedor:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddSupplierPayment = async (newPayment: Omit<SupplierPayment, 'id'>) => {
    try {
      const { error } = await supabase.from('supplier_payments').insert(supplierPaymentToDB(newPayment));
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando pago:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateSupplierPayment = async (payment: SupplierPayment) => {
    try {
      const { error } = await supabase.from('supplier_payments').update(supplierPaymentToDB(payment)).eq('id', payment.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando pago:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddTask = async (newTask: Omit<Task, 'id'>) => {
    try {
      const task = { ...newTask, id: crypto.randomUUID() };
      const { error } = await supabase.from('tasks').insert(taskToDB(task));
      if (error) throw error;
      await emitNotification({
        type: 'task.created',
        title: `Nueva tarea: ${task.title}`,
        body: task.assignee ? `Asignada a ${task.assignee}` : undefined,
        entityId: task.id,
        entityType: 'task',
        entityPage: 'tasks',
        fromUser: currentUser,
      });
      fetchData();
    } catch (err: any) {
      console.error('Error creando tarea:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('¿Eliminar tarea?')) return;
    try {
      const taskToDelete = tasks.find(t => t.id === id);
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      await emitNotification({
        type: 'task.deleted',
        title: `Tarea eliminada${taskToDelete ? ': ' + taskToDelete.title : ''}`,
        entityId: id,
        entityType: 'task',
        entityPage: 'tasks',
        fromUser: currentUser,
      });
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando tarea:', err);
      alert('No se pudo eliminar');
    }
  };

  const handleUpdateTask = async (task: Task) => {
    try {
      const { error } = await supabase.from('tasks').update(taskToDB(task)).eq('id', task.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando tarea:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddProductionOrder = async (newOrder: Omit<ProductionOrder, 'id'>) => {
    try {
      const { error } = await supabase.from('production_orders').insert(newOrder);
      if (error) throw error;
      await emitNotification({
        type: 'production_order.created',
        title: 'Nueva Orden de Producción',
        body: (newOrder as any).itemDescription || undefined,
        entityType: 'production_order',
        entityPage: 'production',
        fromUser: currentUser,
      });
      fetchData();
    } catch (err: any) {
      console.error('Error creando orden:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateProductionOrder = async (order: ProductionOrder) => {
    try {
      const { error } = await supabase.from('production_orders').update(order).eq('id', order.id);
      if (error) throw error;
      await emitNotification({
        type: 'production_order.updated',
        title: 'Orden de Producción actualizada',
        body: (order as any).status ? `Estado: ${(order as any).status}` : undefined,
        entityId: order.id,
        entityType: 'production_order',
        entityPage: 'production',
        fromUser: currentUser,
      });
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando orden:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveEstimate = async (estimate: SavedEstimate) => {
    try {
      const cleaned = {
        ...estimate,
        projectId: estimate.projectId === 'NEW' || !estimate.projectId ? null : estimate.projectId,
        priceListId: (estimate.priceListId && estimate.priceListId !== 'current') ? estimate.priceListId : null,
      };
      const { error } = await supabase.from('saved_estimates').upsert(cleaned);
      if (error) throw error;

      if (estimate.type === 'TECHNICAL' && estimate.projectId && estimate.projectId !== 'NEW') {
        const project = projects.find(p => p.id === estimate.projectId);
        if (project) {
          await handleUpdateProject({
            ...project,
            linkedTechnicalEstimateId: estimate.id
          });
        }
      }
      fetchData();
    } catch (err: any) {
      console.error('Error guardando estimación:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteSavedEstimate = async (id: string) => {
    if (!window.confirm('¿Eliminar estimación?')) return;
    try {
      const { error } = await supabase.from('saved_estimates').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando estimación:', err);
      alert('No se pudo eliminar');
    }
  };

  const handleSaveReport = async (newReport: Report) => {
    try {
      const { error } = await supabase.from('reports').insert(reportToDB(newReport));
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando reporte:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('¿Eliminar este informe? Esta acción no se puede deshacer.')) return;
    try {
      const reportToDelete = reports.find(r => r.id === reportId);
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      if (error) throw error;
      await emitNotification({
        type: 'report.deleted',
        title: `Informe eliminado${reportToDelete ? ': ' + reportToDelete.title : ''}`,
        entityId: reportId,
        entityType: 'report',
        entityPage: 'reports',
        fromUser: currentUser,
      });
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando informe:', err);
      alert(`No se pudo eliminar el informe: ${err.message}`);
    }
  };

  const handleAddUser = async (newUser: User) => {
    try {
      const { error } = await supabase.from('users').insert(userToDB(newUser));
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando usuario:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // ────────────────────────────────────────────────
  // Renderizado de páginas
  // ────────────────────────────────────────────────

  const data: BusinessData = useMemo(() => ({
    clients,
    projects,
    // Mapear estimates → budgets para que Dashboard y BusinessData usen datos reales
    budgets: estimates.map(e => ({
      id: e.id,
      projectId: e.projectId,
      title: e.title,
      description: e.description || '',
      status: e.status,
      totalAmount: e.totalAmount ?? 0,
      downPayment: e.downPayment ?? 0,
      downPaymentDate: e.downPaymentDate || '',
      balance: e.balance ?? 0,
      balanceDate: e.balanceDate || '',
      version: e.version || 1,
      createdAt: e.createdAt || '',
    } as any)),
    suppliers,
    supplierPayments,
    tasks,
    user: currentUser || MOCK_USER_ADMIN
  }), [clients, projects, estimates, suppliers, supplierPayments, tasks, currentUser]);

  // Guard de permisos: verifica si el rol tiene acceso a la ruta actual
  const getPageKeyFromPath = (pathname: string): string => {
    const segment = pathname.replace('/', '').split('/')[0];
    return segment || 'dashboard';
  };

  const renderProtectedRoutes = () => {
    if (!currentUser) return null;
    const role = currentUser.role;
    const pageKey = getPageKeyFromPath(location.pathname);
    const allowedRoles = PAGE_PERMISSIONS[pageKey as keyof typeof PAGE_PERMISSIONS];

    if (allowedRoles && !allowedRoles.includes(role)) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <ShieldCheck size={48} className="mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-600">Acceso Restringido</h2>
          <p className="text-sm">No tienes permisos para ver esta sección.</p>
        </div>
      );
    }

    return (
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }>
        <Routes>
          <Route path="/" element={<Dashboard data={data} userRole={role} />} />

          <Route path="/projects" element={
            <Projects
              projects={projects}
              clients={clients}
              user={currentUser}
              productionOrders={productionOrders}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onNavigateToEstimator={(id) => navigate(`/estimator/${id}`)}
            />
          } />

          <Route path="/clients" element={
            <Clients
              clients={clients}
              user={currentUser!}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
            />
          } />

          <Route path="/tasks" element={
            <Tasks
              tasks={tasks}
              projects={projects}
              users={users}
              currentUser={currentUser}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
            />
          } />

          <Route path="/estimator" element={
            <CostEstimator
              projects={projects}
              clients={clients}
              savedEstimates={savedEstimates}
              userRole={role}
              onSaveEstimate={handleSaveEstimate}
              onDeleteEstimate={handleDeleteSavedEstimate}
            />
          } />

          <Route path="/estimator/:projectId" element={
            <EstimatorWithParam
              projects={projects}
              clients={clients}
              savedEstimates={savedEstimates}
              userRole={role}
              onSaveEstimate={handleSaveEstimate}
              onDeleteEstimate={handleDeleteSavedEstimate}
            />
          } />

          <Route path="/budgets" element={
            <Budgets
              estimates={estimates}
              projects={projects}
              supplierPayments={supplierPayments}
              savedEstimates={savedEstimates}
              priceLists={priceLists}
              user={currentUser}
              userRole={role}
              onAddEstimate={handleAddEstimate}
              onUpdateEstimate={handleUpdateEstimate}
              onDeleteEstimate={handleDeleteEstimate}
            />
          } />

          <Route path="/suppliers" element={
            <SupplierPayments
              payments={supplierPayments}
              suppliers={suppliers}
              projects={projects}
              user={currentUser}
              onAddPayment={handleAddSupplierPayment}
              onUpdatePayment={handleUpdateSupplierPayment}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
            />
          } />

          <Route path="/production" element={
            <Production
              projects={projects}
              clients={clients}
              user={currentUser}
              savedEstimates={savedEstimates}
              productionOrders={productionOrders}
              tasks={tasks}
              users={users}
              onUpdateProject={handleUpdateProject}
              onAddProject={handleAddProject}
              onAddProductionOrder={handleAddProductionOrder}
              onUpdateProductionOrder={handleUpdateProductionOrder}
              onAddTask={handleAddTask}
            />
          } />

          <Route path="/reports" element={
            <Reports
              projects={projects}
              clients={clients}
              tasks={tasks}
              reports={reports}
              user={currentUser}
              onSaveReport={handleSaveReport}
              onDeleteReport={handleDeleteReport}
            />
          } />

          <Route path="/archive" element={
            <Archive
              projects={projects}
              clients={clients}
              savedEstimates={savedEstimates}
              productionOrders={productionOrders}
              reports={reports}
              estimates={estimates}
            />
          } />

          <Route path="/staff" element={<Staff users={users} onAddUser={handleAddUser} />} />

          <Route path="/ai" element={<AIAssistant data={data} user={currentUser!} />} />

          <Route path="/settings" element={<Settings />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {dbError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-lg flex flex-col gap-2 max-w-md w-full">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-sm mb-1">Estado de la Base de Datos</p>
              <p className="text-xs opacity-90">{dbError}</p>
            </div>
            <button 
              onClick={() => setDbError(null)}
              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => {
                setDbError(null);
                fetchData();
              }}
              className="mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              Reintentar conexión ahora
            </button>
            <button 
              onClick={() => {
                setDbError(null);
                loadMockData();
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-gray-900 transition-colors"
            >
              Usar datos de prueba (Modo Demo)
            </button>
          </div>
        </div>
      )}

      {/* 1. Pantalla de Carga (Solo si es explícitamente necesario) */}
      {(isAuthLoading || isProfileLoading) && !session && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-black" />
            <p className="mt-4 text-gray-600 font-bold tracking-widest uppercase text-[10px]">
              Iniciando...
            </p>
          </div>
        </div>
      )}

      {/* 2. Lógica de Pantallas */}
      {!session ? (
        <Login />
      ) : !currentUser ? (
        /* Sesión activa pero perfil cargando */
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-black" />
            <p className="mt-4 text-gray-600 font-bold tracking-widest uppercase text-[10px] mb-8">
              Cargando Perfil...
            </p>
            {isWakingUpDb && (
              <div className="mb-8 max-w-xs mx-auto text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="font-semibold mb-1 text-xs">La base de datos se está despertando.</p>
                <p className="text-[10px] opacity-80">Esto puede tardar hasta 2 minutos. Por favor, no cierres la página.</p>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              {showEmergencyButton && (
                <button 
                  onClick={() => {
                    if (session?.user?.email) {
                      const fallback: User = {
                        id: session.user.id,
                        email: session.user.email,
                        name: "ADMIN EMERGENCIA",
                        role: 'administrador',
                        status: 'ACTIVE',
                        joinedDate: new Date().toISOString(),
                        avatarInitials: "AE"
                      };
                      currentUserRef.current = fallback;
                      setCurrentUser(fallback);
                      fetchData();
                    }
                  }}
                  className="px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-gray-800 transition-colors animate-fade-in"
                >
                  Forzar entrada (Modo Emergencia)
                </button>
              )}
              
              <button 
                onClick={handleForceReset}
                className="text-[10px] underline text-gray-400 hover:text-red-500"
              >
                Cerrar sesión y reintentar
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Aplicación Principal */
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            user={currentUser}
            onToggleRole={() => {}}
            isDark={isDark}
            onToggleDark={toggleDark}
            onLogout={async () => {
              localStorage.clear();
              sessionStorage.clear();
              setSession(null);
              setCurrentUser(null);
              currentUserRef.current = null;
              setIsAuthLoading(false);
              setIsProfileLoading(false);
              supabase.auth.signOut().catch(err => console.warn("Supabase signOut error (ignored):", err));
              window.location.href = window.location.origin;
            }}
          />

          <div className="lg:pl-64">
            {/* Mobile Header */}
            <header className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tighter text-roden-black">rødën</h1>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold border-l border-gray-200 pl-2">OS</span>
              </div>
              <div className="flex items-center gap-2">
                {currentUser.role === 'administrador' && <NotificationBell currentUser={currentUser} />}
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Abrir menu"
                >
                  <Menu size={24} className="text-roden-black" />
                </button>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-6 pb-24 lg:pb-6">
              {renderProtectedRoutes()}
            </main>
          </div>

          {/* Bottom Navigation — mobile only */}
          <BottomNav
            onOpenSidebar={() => setIsSidebarOpen(true)}
            isDark={isDark}
          />
        </>
      )}
    </div>
  );
};

// ── Wrapper para ruta /estimator/:projectId ──
interface EstimatorWithParamProps {
  projects: import('./types').Project[];
  clients: import('./types').Client[];
  savedEstimates: import('./types').SavedEstimate[];
  userRole: import('./types').UserRole;
  onSaveEstimate: (est: import('./types').SavedEstimate) => void;
  onDeleteEstimate: (id: string) => void;
}

const EstimatorWithParam: React.FC<EstimatorWithParamProps> = (props) => {
  const { projectId } = useParams<{ projectId: string }>();
  return <CostEstimator {...props} initialProjectId={projectId} />;
};

export default App;
