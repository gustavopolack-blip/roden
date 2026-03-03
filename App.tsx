import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import CostEstimator from './pages/CostEstimator';
import Login from './pages/Login';

import {
  MOCK_USER_ADMIN,
  MOCK_CLIENTS,
  MOCK_PROJECTS,
  MOCK_BUDGETS,
  MOCK_SUPPLIERS,
  MOCK_SUPPLIER_PAYMENTS,
  MOCK_TASKS
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
  ProjectDossier
} from './types';

import { supabase } from './services/supabaseClient';
import { Loader2, Menu, ShieldAlert, RefreshCw, X } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isWakingUpDb, setIsWakingUpDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getRoleByEmail = (email: string): UserRole => {
    const lower = email.toLowerCase();
    if (lower === 'gustavopolack@gmail.com') return 'administrador';
    if (lower === 'f.61r@gmail.com') return 'gerente_taller';
    if (lower === 'alang_32@hotmail.com') return 'operario_taller';
    return 'operario_taller';
  };

  const fetchData = async () => {
    console.log("[fetchData] Started.");
    setIsSyncing(true);
    try {
      // Asegurarse de tener una sesión válida antes de consultar
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        console.warn("[fetchData] No hay sesión activa, abortando carga de datos.");
        return;
      }

      console.log("[fetchData] Awaiting Promise.allSettled...");
      
      const fetchPromise = Promise.allSettled([
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('budgets').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('supplier_payments').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('users').select('*'),
        supabase.from('reports').select('*'),
        supabase.from('production_orders').select('*'),
        supabase.from('saved_estimates').select('*')
      ]);

      const wakingUpTimeout = setTimeout(() => {
        setIsWakingUpDb(true);
      }, 5000);

      const results = await fetchPromise;
      clearTimeout(wakingUpTimeout);
      setIsWakingUpDb(false);
      
      console.log("[fetchData] Promise.allSettled completed.");

      const [cRes, pRes, bRes, sRes, spRes, tRes, uRes, rRes, poRes, seRes] = results;

      // Log errors for debugging
      results.forEach((res, index) => {
        if (res.status === 'rejected') {
          console.error(`[fetchData] Table ${index} failed:`, res.reason);
        } else if (res.value.error) {
          console.error(`[fetchData] Table ${index} returned error:`, res.value.error);
        }
      });

      if (cRes.status === 'fulfilled' && cRes.value.data) setClients(cRes.value.data);
      if (pRes.status === 'fulfilled' && pRes.value.data) setProjects(pRes.value.data);
      if (bRes.status === 'fulfilled' && bRes.value.data) setBudgets(bRes.value.data);
      if (sRes.status === 'fulfilled' && sRes.value.data) setSuppliers(sRes.value.data);
      if (spRes.status === 'fulfilled' && spRes.value.data) setSupplierPayments(spRes.value.data);
      if (tRes.status === 'fulfilled' && tRes.value.data) setTasks(tRes.value.data);
      if (uRes.status === 'fulfilled' && uRes.value.data) setUsers(uRes.value.data);
      if (rRes.status === 'fulfilled' && rRes.value.data) setReports(rRes.value.data);
      if (poRes.status === 'fulfilled' && poRes.value.data) setProductionOrders(poRes.value.data);
      if (seRes.status === 'fulfilled' && seRes.value.data) setSavedEstimates(seRes.value.data);
    } catch (err: any) {
      console.error('[fetchData] Error cargando datos:', err);
      if (err.message?.includes('Timeout')) {
        setDbError('La base de datos está pausada o no responde. Por favor, verifica tu conexión o reactiva el proyecto en Supabase.');
      }
    } finally {
      console.log("[fetchData] Finally block reached.");
      setIsSyncing(false);
    }
  };

  const fetchUserProfile = async (session: Session) => {
    const email = session.user.email ?? '';
    console.log("[fetchUserProfile] START for:", email);
    
    if (isFetchingProfileRef.current) {
      console.log("[fetchUserProfile] ALREADY FETCHING, returning early.");
      return;
    }
    
    isFetchingProfileRef.current = true;
    setIsProfileLoading(true);

    try {
      console.log("[fetchUserProfile] Querying DB for user:", session.user.id);
      
      const wakingUpTimeout = setTimeout(() => {
        setIsWakingUpDb(true);
      }, 5000);

      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("fetchUserProfile timeout")), 20000)
      );

      const result = await Promise.race([profilePromise, timeoutPromise]) as any;
      clearTimeout(wakingUpTimeout);
      setIsWakingUpDb(false);

      const userData = result?.data;
      const profileError = result?.error;

      if (profileError) {
        console.error("[fetchUserProfile] DB Query Error:", profileError);
      }

      let resolvedUser: User | null = null;
      const metadataRole = session.user.user_metadata?.role;

      if (userData) {
        console.log("[fetchUserProfile] User found in DB:", userData.email);
        resolvedUser = userData as User;
        
        if (!resolvedUser.role && metadataRole) {
           resolvedUser.role = metadataRole;
           console.log("[fetchUserProfile] Updating missing role from metadata:", metadataRole);
           await supabase.from('users').update({ role: metadataRole }).eq('id', resolvedUser.id);
        }
      } else {
        console.log("[fetchUserProfile] User NOT in DB, attempting upsert/create...");
        const assignedRole = metadataRole || getRoleByEmail(email);
        const newUser: User = {
          id: session.user.id,
          email,
          name: email.split('@')[0] || 'Usuario',
          phone: '',
          role: assignedRole,
          status: 'ACTIVE',
          joinedDate: new Date().toISOString().split('T')[0],
          avatarInitials: email.substring(0, 2).toUpperCase() || 'US'
        };

        const { data: upsertData, error: upsertError } = await supabase
          .from('users')
          .upsert(newUser, { onConflict: 'email' })
          .select()
          .maybeSingle();
        
        if (upsertError) {
          console.error("[fetchUserProfile] Upsert Error:", upsertError);
          resolvedUser = newUser;
        } else {
          console.log("[fetchUserProfile] Upsert Success.");
          resolvedUser = (upsertData as User) || newUser;
        }
      }

      // Final role check
      if (resolvedUser && !resolvedUser.role) {
         resolvedUser.role = getRoleByEmail(email);
      }

      if (resolvedUser) {
        console.log("[fetchUserProfile] SUCCESS. Setting currentUser state:", resolvedUser.email, resolvedUser.role);
        currentUserRef.current = resolvedUser;
        setCurrentUser(resolvedUser);
        
        // Sync metadata if needed (don't await to speed up UI)
        // REMOVED refreshSession to avoid potential loops
        if (session.user.user_metadata?.role !== resolvedUser.role) {
          console.log("[fetchUserProfile] Syncing role to metadata...");
          supabase.auth.updateUser({ data: { role: resolvedUser.role } });
        }

        // Trigger data fetch
        fetchData();
      } else {
        throw new Error("Failed to resolve user object");
      }

    } catch (err: any) {
      console.error('[fetchUserProfile] CRITICAL ERROR, using fallback:', err);
      
      const fallbackUser: User = {
        id: session.user.id,
        email,
        name: email.split('@')[0] || 'Usuario',
        phone: '',
        role: getRoleByEmail(email),
        status: 'ACTIVE',
        joinedDate: new Date().toISOString().split('T')[0],
        avatarInitials: email.substring(0, 2).toUpperCase() || 'US'
      };
      
      currentUserRef.current = fallbackUser;
      setCurrentUser(fallbackUser);
      fetchData();
    } finally {
      console.log("[fetchUserProfile] FINISHED. Unblocking UI.");
      setIsAuthLoading(false);
      setIsProfileLoading(false);
      isFetchingProfileRef.current = false;
    }
  };

  const handleForceReset = async () => {
    console.log("Force Reset triggered");
    setIsAuthLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      setSession(null);
      setCurrentUser(null);
      setIsAuthLoading(false);
      setCurrentPage('dashboard');
      window.location.reload();
    } catch (e) {
      console.error("Force reset error:", e);
      setIsAuthLoading(false);
    }
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
        console.warn("[Global Safety Timeout] Unblocking UI after 10s");
        setIsAuthLoading(false);
        setIsProfileLoading(false);
      }
    }, 10000);

    const checkInitialSession = async () => {
      console.log("[checkInitialSession] Checking...");
      
      // Increased safety timeout for getSession (10s)
      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => 
        timeoutId = setTimeout(() => reject(new Error("getSession timeout")), 10000)
      );

      try {
        const result = await Promise.race([supabase.auth.getSession(), timeoutPromise]) as any;
        clearTimeout(timeoutId);
        
        const initialSession = result?.data?.session;
        const error = result?.error;
        
        if (error) throw error;
        
        if (mounted && initialSession) {
          console.log("[checkInitialSession] Session found:", initialSession.user.email);
          setSession(initialSession);
          if (!currentUserRef.current) {
            // Don't await here to allow checkInitialSession to finish and unblock isAuthLoading
            fetchUserProfile(initialSession);
          }
        } else {
          console.log("[checkInitialSession] No session.");
        }
      } catch (e) {
        console.error("[checkInitialSession] Error or Timeout:", e);
        // On timeout or error, we ensure we are not stuck
        if (mounted) {
          setIsAuthLoading(false);
          setIsProfileLoading(false);
        }
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      console.log(`[onAuthStateChange] Event: ${event}`, newSession?.user?.email);

      try {
        if (newSession) {
          setSession(newSession);
          if (currentUserRef.current?.email !== newSession.user.email) {
            if (!isFetchingProfileRef.current) {
              await fetchUserProfile(newSession);
            }
          } else {
            setIsAuthLoading(false);
            setIsProfileLoading(false);
          }
        } else {
          console.log("[onAuthStateChange] No session, cleaning up.");
          setSession(null);
          setCurrentUser(null);
          currentUserRef.current = null;
          setIsAuthLoading(false);
          setIsProfileLoading(false);
          if (event === 'SIGNED_OUT') setCurrentPage('dashboard');
        }
      } catch (e) {
        console.error("[onAuthStateChange] Error:", e);
        setIsAuthLoading(false);
        setIsProfileLoading(false);
      }
    });

    checkInitialSession();

    return () => {
      mounted = false;
      clearTimeout(globalSafetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (currentUser && !isAuthLoading && currentUser.role !== 'administrador' && currentPage === 'dashboard') {
      setCurrentPage('projects');
    }
  }, [currentUser, isAuthLoading, currentPage]);

  // ────────────────────────────────────────────────
  // CRUD Handlers
  // ────────────────────────────────────────────────

  const handleAddClient = async (newClient: Omit<Client, 'id'>) => {
    try {
      const { error } = await supabase.from('clients').insert(newClient);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando cliente:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateClient = async (client: Client) => {
    try {
      const { error } = await supabase.from('clients').update(client).eq('id', client.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando cliente:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando cliente:', err);
      alert(`Error al eliminar cliente: ${err.message}`);
    }
  };

  const handleAddProject = async (newProject: Omit<Project, 'id'>) => {
    try {
      const { error } = await supabase.from('projects').insert(newProject);
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

      const { error } = await supabase.from('projects').update(project).eq('id', project.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando proyecto:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddBudget = async (newBudget: Omit<Budget, 'id'>) => {
    try {
      const { error } = await supabase.from('budgets').insert(newBudget);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando presupuesto:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateBudget = async (budget: Budget) => {
    try {
      const { error } = await supabase.from('budgets').update(budget).eq('id', budget.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando presupuesto:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!window.confirm('¿Eliminar este presupuesto?')) return;
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando presupuesto:', err);
      alert('No se pudo eliminar');
    }
  };

  const handleAddSupplier = async (newSupplier: Omit<Supplier, 'id'>) => {
    try {
      const { error } = await supabase.from('suppliers').insert(newSupplier);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando proveedor:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateSupplier = async (supplier: Supplier) => {
    try {
      const { error } = await supabase.from('suppliers').update(supplier).eq('id', supplier.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error actualizando proveedor:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddSupplierPayment = async (newPayment: Omit<SupplierPayment, 'id'>) => {
    try {
      const { error } = await supabase.from('supplier_payments').insert(newPayment);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando pago:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateSupplierPayment = async (payment: SupplierPayment) => {
    try {
      const { error } = await supabase.from('supplier_payments').update(payment).eq('id', payment.id);
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
      const { error } = await supabase.from('tasks').insert(task);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando tarea:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('¿Eliminar tarea?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error eliminando tarea:', err);
      alert('No se pudo eliminar');
    }
  };

  const handleAddProductionOrder = async (newOrder: Omit<ProductionOrder, 'id'>) => {
    try {
      const { error } = await supabase.from('production_orders').insert(newOrder);
      if (error) throw error;
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
        projectId: estimate.projectId === 'NEW' || !estimate.projectId ? null : estimate.projectId
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

  const handleDeleteEstimate = async (id: string) => {
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

  const handleSaveReport = async (newReport: Omit<Report, 'id'>) => {
    try {
      const { error } = await supabase.from('reports').insert(newReport);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error creando reporte:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddUser = async (newUser: User) => {
    try {
      const { error } = await supabase.from('users').insert(newUser);
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
    budgets,
    suppliers,
    supplierPayments,
    tasks,
    user: currentUser || MOCK_USER_ADMIN
  }), [clients, projects, budgets, suppliers, supplierPayments, tasks, currentUser]);

  const renderContent = () => {
    if (!currentUser) return null;

    const role = currentUser.role;

    switch (currentPage) {
      case 'dashboard':
        return role === 'administrador' ? <Dashboard data={data} /> : null;

      case 'projects':
        return (
          <Projects
            projects={projects}
            clients={clients}
            user={currentUser}
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onNavigateToEstimator={(id) => {
              setSelectedProjectId(id);
              setCurrentPage('estimator');
            }}
          />
        );

      case 'clients':
        return role === 'administrador' ? (
          <Clients
            clients={clients}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
          />
        ) : null;

      case 'tasks':
        return (
          <Tasks
            tasks={tasks}
            projects={projects}
            users={users}
            currentUser={currentUser}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
          />
        );

      case 'estimator':
        return role === 'administrador' ? (
          <CostEstimator
            projects={projects}
            clients={clients}
            savedEstimates={savedEstimates}
            onSaveEstimate={handleSaveEstimate}
            onDeleteEstimate={handleDeleteEstimate}
            initialProjectId={selectedProjectId ?? undefined}
          />
        ) : null;

      case 'budgets':
        return role === 'administrador' ? (
          <Budgets
            budgets={budgets}
            projects={projects}
            supplierPayments={supplierPayments}
            savedEstimates={savedEstimates}
            onAddBudget={handleAddBudget}
            onUpdateBudget={handleUpdateBudget}
            onDeleteBudget={handleDeleteBudget}
          />
        ) : null;

      case 'suppliers':
        return ['administrador', 'gerente_taller'].includes(role) ? (
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
        ) : null;

      case 'production':
        return (
          <Production
            projects={projects}
            clients={clients}
            user={currentUser}
            savedEstimates={savedEstimates}
            productionOrders={productionOrders}
            onUpdateProject={handleUpdateProject}
            onAddProject={handleAddProject}
            onAddProductionOrder={handleAddProductionOrder}
            onUpdateProductionOrder={handleUpdateProductionOrder}
          />
        );

      case 'reports':
        return (
          <Reports
            projects={projects}
            clients={clients}
            tasks={tasks}
            reports={reports}
            user={currentUser}
            onSaveReport={handleSaveReport}
          />
        );

      case 'archive':
        return role === 'administrador' ? <Archive projects={projects} clients={clients} /> : null;

      case 'staff':
        return role === 'administrador' ? <Staff users={users} onAddUser={handleAddUser} /> : null;

      case 'settings':
        return role === 'administrador' ? <Settings /> : null;

      default:
        return <div className="p-8">Página no encontrada</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {dbError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 max-w-md w-full">
          <div className="flex-1">
            <p className="font-bold text-sm mb-1">Error de conexión</p>
            <p className="text-xs opacity-90">{dbError}</p>
          </div>
          <button 
            onClick={() => setDbError(null)}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
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
            <button 
              onClick={handleForceReset}
              className="mt-4 text-[10px] underline text-gray-400 hover:text-red-500"
            >
              Cerrar sesión y reintentar
            </button>
          </div>
        </div>
      ) : (
        /* Aplicación Principal */
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            currentPage={currentPage}
            onNavigate={setCurrentPage}
            user={currentUser}
            onToggleRole={() => {}}
            onLogout={async () => {
              await supabase.auth.signOut();
              setSession(null);
              setCurrentUser(null);
              currentUserRef.current = null;
            }}
          />

          <div className="lg:pl-64">
            <main className="min-h-screen p-4 md:p-6 lg:p-8">
              {renderContent()}

              {isSyncing && (
                <div className="fixed bottom-6 right-6 bg-black text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
