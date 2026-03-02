
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
  MOCK_CLIENTS, MOCK_PROJECTS, MOCK_BUDGETS, MOCK_SUPPLIERS,
  MOCK_SUPPLIER_PAYMENTS, MOCK_TASKS 
} from './constants';
import { BusinessData, Client, Project, Budget, Task, User, UserRole, SupplierPayment, Report, Supplier, SavedEstimate, ProductionOrder, ProductionOrderStatus, ProjectDossier } from './types';
import { supabase } from './services/supabaseClient';
import { Loader2, Menu, ShieldAlert, CloudLightning, RefreshCw } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Loading States
  const [isAuthLoading, setIsAuthLoading] = useState(true); // Blocks screen (Auth check)
  const [isProfileLoading, setIsProfileLoading] = useState(false); // New state for profile fetch
  const [isSyncing, setIsSyncing] = useState(false); // Background loading (Data fetch)
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Refs for auth state management
  const currentUserRef = useRef<User | null>(null);
  const isFetchingProfileRef = useRef<boolean>(false);
  
  // Helper to set user and update ref immediately
  const updateCurrentUser = (user: User | null) => {
    console.log("Updating current user state and ref:", user?.email);
    currentUserRef.current = user;
    setCurrentUser(user);
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
  
  // App State
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  
  // Initialize Saved Estimates
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);
  
  // Ref to handle debounce for realtime updates
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- AUTH INITIALIZATION & LISTENER ---
  useEffect(() => {
    let mounted = true;

    // Safety timeout: If auth takes too long, unblock the UI so user can see login form
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        if (isAuthLoading || isProfileLoading) {
          console.warn("Auth/Profile safety timeout reached. Unblocking UI.");
          setIsAuthLoading(false);
          setIsProfileLoading(false);
        }
      }
    }, 20000); 

    // Single source of truth for Auth: onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      try {
        console.group(`Auth Event: ${event}`);
        console.log('Session present:', !!newSession);
        console.log('Current User (Ref):', currentUserRef.current?.email);
        
        if (newSession) {
            setSession(newSession);
            const currentEmail = currentUserRef.current?.email;
            
            if (currentEmail !== newSession.user.email) {
              if (isFetchingProfileRef.current) {
                console.log("Already fetching profile, skipping...");
              } else {
                console.log("Email mismatch or new login, fetching profile...");
                setIsProfileLoading(true);
                await fetchUserProfile(newSession);
              }
            } else {
              console.log("User already matched, unblocking UI");
              setIsAuthLoading(false);
              setIsProfileLoading(false);
            }
        } else {
            console.log("No session or SIGNED_OUT, cleaning up...");
            setSession(null);
            updateCurrentUser(null);
            setClients([]); 
            setProjects([]);
            setBudgets([]);
            setSuppliers([]);
            setSupplierPayments([]);
            setTasks([]);
            setReports([]);
            setUsers([]);
            setSavedEstimates([]);
            setIsAuthLoading(false);
            setIsProfileLoading(false);
            if (event === 'SIGNED_OUT') setCurrentPage('dashboard');
        }
      } catch (err) {
        console.error("Error in onAuthStateChange handler:", err);
        setIsAuthLoading(false);
      } finally {
        console.groupEnd();
      }
    });

    // Manual initial check to be absolutely sure
    const checkInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (mounted && initialSession) {
        setSession(initialSession);
        if (!currentUserRef.current) {
          console.log("Manual initial session check found session, fetching profile...");
          setIsProfileLoading(true);
          await fetchUserProfile(initialSession);
        }
      }
      if (mounted) setIsAuthLoading(false);
    };
    checkInitialSession();

    return () => {
        mounted = false;
        clearTimeout(safetyTimeout);
        subscription.unsubscribe();
    };
  }, []); // Run only once on mount

  // --- ROLE BASED REDIRECT ---
  useEffect(() => {
    if (currentUser && !isAuthLoading) {
        if (currentUser.role !== 'administrador' && currentPage === 'dashboard') {
            setCurrentPage('projects');
        }
    }
  }, [currentUser, isAuthLoading]);

  // --- REALTIME SUBSCRIPTION (DEBOUNCED) ---
  useEffect(() => {
      if (!currentUser) return;

      const channel = supabase.channel('db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload) => {
            console.log('Realtime change detected, scheduling update...', payload);
            
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }

            fetchTimeoutRef.current = setTimeout(() => {
                console.log('Executing debounced data refresh.');
                fetchData(); 
            }, 1000);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Connected to Realtime updates');
          }
        });

      return () => {
        supabase.removeChannel(channel);
        if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
        }
      };
  }, [currentUser?.id]);

  const fetchUserProfile = async (currentSession: Session) => {
      if (isFetchingProfileRef.current) return;
      isFetchingProfileRef.current = true;
      
      const email = currentSession.user.email;
      if (!email) {
          setIsAuthLoading(false);
          isFetchingProfileRef.current = false;
          return;
      }

      // Helper to get role by email
      const getRoleByEmail = (email: string): UserRole => {
        const lowerEmail = email.toLowerCase();
        if (lowerEmail === 'gustavopolack@gmail.com') return 'administrador';
        if (lowerEmail === 'f.61r@gmail.com') return 'gerente_taller';
        if (lowerEmail === 'alang_32@hotmail.com') return 'operario_taller';
        return 'administrador'; // Default for others
      };
      
      try {
        console.log("--- fetchUserProfile START ---", email);
        
        // Intentar obtener el perfil con un timeout de 15 segundos
        const profilePromise = supabase.from('users').select('*').eq('email', email).maybeSingle();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout fetching profile')), 30000)
        );

        const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;
        
        if (data && !error) {
            console.log("Profile found in DB:", data.role);
            
            // Fix role if it's incorrect for the specific users
            const correctRole = getRoleByEmail(email);
            if (data.role !== correctRole) {
                console.log(`Correcting role for ${email} from ${data.role} to ${correctRole}`);
                const updatedUser = { ...data, role: correctRole };
                supabase.from('users').update({ role: correctRole }).eq('email', email).then();
                updateCurrentUser(updatedUser as User);
            } else {
                updateCurrentUser(data as User);
            }
            fetchData(); 
        } else {
            console.log("Profile NOT found or DB error, creating base profile...");
            const newUser: User = {
                id: currentSession.user.id,
                email: email,
                name: email.split('@')[0], 
                phone: '',
                role: getRoleByEmail(email), 
                status: 'ACTIVE',
                joinedDate: new Date().toISOString().split('T')[0],
                avatarInitials: email.substring(0, 2).toUpperCase()
            };

            try {
              // Intentar insertar pero no bloquear si falla
              supabase.from('users').insert(newUser).then(({error}) => {
                if (error) console.warn("Could not persist profile:", error.message);
              });
            } catch (e) {
              console.warn("Could not persist profile (expected if table missing)", e);
            }
            
            updateCurrentUser(newUser);
            fetchData(); 
        }
      } catch (e: any) {
        console.warn("Profile fetch issue (using fallback):", e.message);
        // Fallback user para no bloquear al usuario
        const fallbackUser: User = {
            id: currentSession.user.id,
            email: email,
            name: email.split('@')[0],
            phone: '',
            role: getRoleByEmail(email),
            status: 'ACTIVE',
            joinedDate: new Date().toISOString().split('T')[0],
            avatarInitials: email.substring(0, 2).toUpperCase()
        };
        updateCurrentUser(fallbackUser);
        fetchData();
      } finally {
        console.log("--- fetchUserProfile END ---");
        setIsAuthLoading(false);
        setIsProfileLoading(false);
        isFetchingProfileRef.current = false;
      }
  };

  const loadDemoData = async () => {
      if (confirm("¿Estás seguro? Esto insertará datos de prueba en tu base de datos.")) {
          setIsSyncing(true);
          try {
              await supabase.from('clients').upsert(MOCK_CLIENTS);
              await supabase.from('projects').upsert(MOCK_PROJECTS);
              await supabase.from('suppliers').upsert(MOCK_SUPPLIERS);
              await supabase.from('budgets').upsert(MOCK_BUDGETS);
              await supabase.from('tasks').upsert(MOCK_TASKS);
              await supabase.from('supplier_payments').upsert(MOCK_SUPPLIER_PAYMENTS);
              fetchData();
              alert("Datos de prueba cargados exitosamente.");
          } catch (e) {
              console.error(e);
              alert("Error cargando datos de prueba.");
          } finally {
              setIsSyncing(false);
          }
      }
  };

  const fetchData = async () => {
      // Only set Syncing indicator, DO NOT block entire UI
      setIsSyncing(true);
      try {
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

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching data')), 30000)
          );

          const results = await Promise.race([fetchPromise, timeoutPromise]) as any[];

          const processResult = (res: any, setter: Function) => {
            if (res.status === 'fulfilled' && res.value.data) {
              setter(res.value.data);
            }
          };

          processResult(results[0], setClients);
          processResult(results[1], setProjects);
          processResult(results[2], setBudgets);
          processResult(results[3], setSuppliers);
          processResult(results[4], setSupplierPayments);
          processResult(results[5], setTasks);
          processResult(results[6], setUsers);
          processResult(results[7], setReports);
          processResult(results[8], setProductionOrders);
          processResult(results[9], setSavedEstimates);

      } catch (error: any) {
          console.error("Error fetching data:", error.message);
      } finally {
          setIsSyncing(false);
      }
  };

  const toggleUserRole = () => {
    if (!currentUser) return;
    const nextRole = currentUser.role === 'administrador' ? 'operario_taller' : currentUser.role === 'operario_taller' ? 'gerente_taller' : 'administrador';
    setCurrentUser({ ...currentUser, role: nextRole });
  };

  const handleLogout = async () => {
      setIsAuthLoading(true);
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Error signing out:", error);
      } finally {
        setSession(null);
        setCurrentUser(null);
        setClients([]);
        setProjects([]);
        setBudgets([]);
        setSuppliers([]);
        setSupplierPayments([]);
        setTasks([]);
        setUsers([]);
        setReports([]);
        setSavedEstimates([]);
        localStorage.removeItem('roden_saved_estimates'); 
        setCurrentPage('dashboard');
        setIsAuthLoading(false);
      }
  };

  // --- CRUD HANDLERS ---
  const handleAddClient = async (newClient: Client) => {
    const { id, ...clientData } = newClient;
    const { error } = await supabase.from('clients').insert(clientData); 
    if (error) {
      console.error("Error creating client:", error);
      alert(`Error al crear cliente: ${error.message}`);
    } else {
      fetchData(); 
    }
  };
  const handleUpdateClient = async (updatedClient: Client) => {
    await supabase.from('clients').update(updatedClient).eq('id', updatedClient.id);
    fetchData();
  };
  const handleAddProject = async (newProject: Project) => {
    const { id, ...projectData } = newProject;
    const { error } = await supabase.from('projects').insert(projectData);
    if (error) {
      console.error("Error creating project:", error);
      alert(`Error al crear proyecto: ${error.message}`);
    } else {
      fetchData();
    }
  };
  const handleUpdateProject = async (updatedProject: Project) => {
    // Check if project is being completed/archived
    const oldProject = projects.find(p => p.id === updatedProject.id);
    if (updatedProject.status === 'COMPLETED' && oldProject?.status !== 'COMPLETED') {
      // Generate Dossier (Legajo)
      const client = clients.find(c => c.id === updatedProject.clientId);
      
      // Calculate total cost from supplier payments
      const projectCosts = supplierPayments
        .filter(sp => sp.projectId === updatedProject.id)
        .reduce((sum, sp) => sum + sp.totalAmount, 0);

      const dossier: ProjectDossier = {
        generatedAt: new Date().toISOString(),
        summary: `Obra finalizada: ${updatedProject.title}.`,
        totalBudget: updatedProject.budget,
        totalCost: projectCosts,
        profitability: updatedProject.budget - projectCosts,
        keyDates: {
          start: updatedProject.startDate || '',
          end: new Date().toISOString().split('T')[0]
        },
        clientSnapshot: {
          name: client?.name || 'Desconocido'
        }
      };
      
      updatedProject.dossier = dossier;
    }

    await supabase.from('projects').update(updatedProject).eq('id', updatedProject.id);
    fetchData();
  };

  const handleAddProductionOrder = async (newOrder: ProductionOrder) => {
    const { id, ...orderData } = newOrder;
    const { error } = await supabase.from('production_orders').insert(orderData);
    if (error) {
      console.error("Error creating production order:", error);
      alert(`Error al crear orden de producción: ${error.message}`);
    } else {
      fetchData();
    }
  };

  const handleUpdateProductionOrder = async (updatedOrder: ProductionOrder) => {
    await supabase.from('production_orders').update(updatedOrder).eq('id', updatedOrder.id);
    fetchData();
  };
  
  // --- BUDGET HANDLERS ---
  const handleAddBudget = async (newBudget: Budget) => {
    const { id, ...budgetData } = newBudget;
    const { error } = await supabase.from('budgets').insert(budgetData);
    if (error) {
      console.error("Error creating budget:", error);
      alert(`Error al crear presupuesto: ${error.message}`);
    } else {
      fetchData();
    }
  };
  const handleUpdateBudget = async (updatedBudget: Budget) => {
    await supabase.from('budgets').update(updatedBudget).eq('id', updatedBudget.id);
    fetchData();
  };
  const handleDeleteBudget = async (budgetId: string) => {
    if(!confirm("¿Estás seguro de que deseas eliminar este presupuesto?")) return;
    const { error } = await supabase.from('budgets').delete().eq('id', budgetId);
    if(error) {
        alert("Error eliminando presupuesto");
        console.error(error);
    } else {
        fetchData();
    }
  };

  const handleAddSupplier = async (newSupplier: Supplier) => {
    const { id, ...supplierData } = newSupplier;
    const { error } = await supabase.from('suppliers').insert(supplierData);
    if (error) {
      console.error("Error creating supplier:", error);
      alert(`Error al crear proveedor: ${error.message}`);
    } else {
      fetchData();
    }
  };
  const handleUpdateSupplier = async (updatedSupplier: Supplier) => {
    await supabase.from('suppliers').update(updatedSupplier).eq('id', updatedSupplier.id);
    fetchData();
  };
  const handleAddSupplierPayment = async (newPayment: SupplierPayment) => {
    const { id, ...paymentData } = newPayment;
    const { error } = await supabase.from('supplier_payments').insert(paymentData);
    if (error) {
      console.error("Error creating payment:", error);
      alert(`Error al crear pago: ${error.message}`);
    } else {
      fetchData();
    }
  };
  const handleUpdateSupplierPayment = async (updatedPayment: SupplierPayment) => {
    await supabase.from('supplier_payments').update(updatedPayment).eq('id', updatedPayment.id);
    fetchData();
  };
  const handleAddTask = async (newTask: Task) => {
    const taskUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    const { id, ...taskData } = newTask;
    const payload = { ...taskData, id: taskUUID, projectId: taskData.projectId || null };

    const { error } = await supabase.from('tasks').insert(payload);
    if (error) {
        console.error("Error creating task:", error);
        alert(`Error al crear la tarea: ${error.message}`);
    } else {
        fetchData();
    }
  };
  const handleDeleteTask = async (taskId: string) => {
      if (!confirm("¿Estás seguro de que deseas archivar/eliminar esta tarea?")) return;
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) {
          console.error("Error deleting task:", error);
          alert("Error al eliminar la tarea.");
      } else {
          fetchData();
      }
  };

  const handleAddUser = async (newUser: User) => {
    const { id, ...userData } = newUser;
    const { error } = await supabase.from('users').insert(userData);
    if (error) {
      console.error("Error creating user:", error);
      alert(`Error al crear usuario: ${error.message}`);
    } else {
      fetchData();
    }
  };
  const handleSaveReport = async (newReport: Report) => {
      const { id, ...reportData } = newReport;
      const { error } = await supabase.from('reports').insert(reportData);
      if (error) {
          console.error("Error creating report:", error);
          alert(`Error al crear reporte: ${error.message}`);
      } else {
          fetchData();
      }
  };

  // --- NEW: ESTIMATE HANDLERS ---
  const handleSaveEstimate = async (estimate: SavedEstimate) => {
      // Clean up estimate for Supabase (e.g. handle 'NEW' project ID)
      const cleanedEstimate = { 
          ...estimate, 
          projectId: (estimate.projectId === 'NEW' || !estimate.projectId) ? null : estimate.projectId 
      };

      const { error } = await supabase.from('saved_estimates').upsert(cleanedEstimate);
      if (error) {
          console.error("Error saving estimate to Supabase:", error);
          // Fallback to local state if Supabase fails (e.g. table not created yet)
          setSavedEstimates(prev => {
              const exists = prev.some(e => e.id === estimate.id);
              return exists ? prev.map(e => e.id === estimate.id ? estimate : e) : [estimate, ...prev];
          });
      } else {
          fetchData();
      }

      if (estimate.type === 'TECHNICAL' && estimate.projectId && estimate.projectId !== 'NEW') {
          const projectToUpdate = projects.find(p => p.id === estimate.projectId);
          if (projectToUpdate) {
              const updatedProject = { ...projectToUpdate, linkedTechnicalEstimateId: estimate.id };
              handleUpdateProject(updatedProject);
          }
      }
  };

  const handleDeleteEstimate = async (estimateId: string) => {
      if (confirm("¿Estás seguro de eliminar esta estimación del historial?")) {
          const { error } = await supabase.from('saved_estimates').delete().eq('id', estimateId);
          if (error) {
              console.error("Error deleting estimate from Supabase:", error);
              setSavedEstimates(prev => prev.filter(e => e.id !== estimateId));
          } else {
              fetchData();
          }
      }
  };

  // --- MEMOIZED DATA CONTEXT ---
  const data: BusinessData = useMemo(() => currentUser 
    ? { clients, projects, budgets, suppliers, supplierPayments, tasks, user: currentUser }
    : { clients: [], projects: [], budgets: [], suppliers: [], supplierPayments: [], tasks: [], user: MOCK_USER_ADMIN }
  , [clients, projects, budgets, suppliers, supplierPayments, tasks, currentUser]);

  // --- RENDER CONTENT LOGIC ---
  const renderContent = () => {
    if (!currentUser) return null;
    let content = null;
    const role = currentUser.role;

    switch (currentPage) {
      case 'dashboard': content = role === 'administrador' ? <Dashboard data={data} /> : null; break;
      case 'projects': content = (
        <Projects 
          projects={data.projects} 
          clients={data.clients} 
          user={currentUser} 
          onAddProject={handleAddProject} 
          onUpdateProject={handleUpdateProject}
          onNavigateToEstimator={(projectId) => {
            setSelectedProjectId(projectId);
            setCurrentPage('estimator');
          }}
        />
      ); break;
      case 'clients': content = role === 'administrador' ? (
        <Clients 
          clients={data.clients} 
          onAddClient={handleAddClient} 
          onUpdateClient={handleUpdateClient}
        />
      ) : null; break;
      case 'tasks': content = <Tasks tasks={data.tasks} projects={data.projects} users={users} currentUser={currentUser} onAddTask={handleAddTask} onDeleteTask={handleDeleteTask} />; break;
      case 'ai': content = role === 'administrador' ? <AIAssistant data={data} userEmail={currentUser.email} /> : null; break;
      case 'archive': content = role === 'administrador' ? <Archive projects={data.projects} clients={data.clients} /> : null; break;
      case 'reports': content = ['administrador', 'gerente_taller', 'operario_taller'].includes(role) ? <Reports projects={data.projects} clients={data.clients} tasks={data.tasks} reports={reports} user={currentUser} onSaveReport={handleSaveReport}/> : null; break;
      case 'estimator': 
        content = role === 'administrador' ? 
            <CostEstimator 
                projects={data.projects} 
                clients={data.clients}
                savedEstimates={savedEstimates} 
                onSaveEstimate={handleSaveEstimate}
                onDeleteEstimate={handleDeleteEstimate}
                onAddProductionOrder={handleAddProductionOrder}
                initialProjectId={selectedProjectId || undefined}
            /> 
            : null; 
        break;
      case 'budgets': 
        content = role === 'administrador' ? 
            <Budgets 
                budgets={data.budgets} 
                projects={data.projects} 
                supplierPayments={data.supplierPayments} 
                savedEstimates={savedEstimates} 
                onAddBudget={handleAddBudget}
                onUpdateBudget={handleUpdateBudget}
                onDeleteBudget={handleDeleteBudget}
            /> 
            : null; 
        break;
      case 'suppliers': content = ['administrador', 'gerente_taller'].includes(role) ? <SupplierPayments payments={data.supplierPayments} suppliers={data.suppliers} projects={data.projects} user={currentUser} onAddPayment={handleAddSupplierPayment} onUpdatePayment={handleUpdateSupplierPayment} onAddSupplier={handleAddSupplier} onUpdateSupplier={handleUpdateSupplier}/> : null; break;
      case 'production': 
        content = <Production 
            projects={data.projects} 
            clients={data.clients} 
            user={currentUser} 
            savedEstimates={savedEstimates} 
            onUpdateProject={handleUpdateProject} 
            onAddProject={handleAddProject}
            productionOrders={productionOrders}
            onUpdateProductionOrder={handleUpdateProductionOrder}
            onAddProductionOrder={handleAddProductionOrder}
        />; 
        break;
      case 'staff': content = role === 'administrador' ? <Staff users={users} onAddUser={handleAddUser} /> : null; break;
      case 'settings': content = role === 'administrador' ? <Settings onLoadDemoData={loadDemoData} /> : null; break;
      default: content = <Projects projects={data.projects} clients={data.clients} user={currentUser} onAddProject={handleAddProject} onUpdateProject={handleUpdateProject}/>;
    }

    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                <ShieldAlert size={64} className="mb-4 text-gray-300" />
                <h2 className="text-xl font-bold text-gray-500">Acceso Restringido</h2>
                <button onClick={() => setCurrentPage('projects')} className="mt-6 px-6 py-2 bg-roden-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors">
                    Ir a Proyectos
                </button>
            </div>
        );
    }

    return content;
  };

  const handleNavigate = (page: string) => {
      setCurrentPage(page);
      setIsSidebarOpen(false); 
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-roden-black selection:bg-black selection:text-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside { display: none !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .pt-16 { padding-top: 0 !important; }
          .lg\\:pt-0 { padding-top: 0 !important; }
          .p-4, .md\\:p-8, .lg\\:p-12 { padding: 0 !important; }
          .max-w-\\[1440px\\] { max-width: none !important; }
          body { background-color: white !important; }
          
          /* New visibility logic for portals and modals */
          body > #root > * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible !important; }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
      
      {/* 1. AUTH LOADING STATE (Full Screen Blocker) */}
      {(isAuthLoading || (session && isProfileLoading && !currentUser)) && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white text-gray-400">
            <div className="w-12 h-12 border-4 border-roden-black border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="animate-pulse font-bold text-roden-black tracking-widest uppercase text-xs mb-8">
              {isProfileLoading ? 'Cargando Perfil de Usuario...' : 'Inicio de sesión segura'}
            </p>
            
            <div className="flex flex-col items-center gap-3">
              <button 
                onClick={() => { setIsAuthLoading(false); setIsProfileLoading(false); }}
                className="text-xs underline hover:text-roden-black transition-colors"
              >
                ¿Demora demasiado? Ir al inicio de sesión
              </button>
              
              <button 
                onClick={handleForceReset}
                className="text-[10px] uppercase tracking-widest text-gray-300 hover:text-red-500 transition-colors"
              >
                ¿Bucle de ingreso? Reiniciar sesión por completo
              </button>
            </div>
        </div>
      )}

      {/* 2. AUTHENTICATED APP */}
      {!isAuthLoading && session && currentUser && (
        <>
          {/* Mobile Header */}
          <div className="lg:hidden fixed top-0 left-0 w-full bg-white z-40 border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm print:hidden">
             <div className="flex items-center gap-3">
                 <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg">
                     <Menu size={24} />
                 </button>
                 <h1 className="font-bold text-lg tracking-tighter">rødën OS</h1>
             </div>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${currentUser.role === 'administrador' ? 'bg-roden-black' : 'bg-indigo-600'}`}>
                {currentUser.avatarInitials || 'U'}
             </div>
          </div>

          <Sidebar 
            currentPage={currentPage} 
            onNavigate={handleNavigate} 
            user={currentUser}
            onToggleRole={toggleUserRole}
            onLogout={handleLogout}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
          
          <main className="lg:pl-64 pt-16 lg:pt-0 print:pl-0 transition-all duration-300">
            {/* Background Sync Indicator */}
            {isSyncing && (
                <div className="fixed bottom-4 right-4 z-[100] bg-white border border-gray-200 shadow-lg px-4 py-2 rounded-full flex items-center gap-2 animate-bounce-in print:hidden">
                    <RefreshCw size={14} className="animate-spin text-indigo-600" />
                    <span className="text-xs font-bold text-gray-600">Sincronizando...</span>
                </div>
            )}
            
            <div className="max-w-[1440px] mx-auto p-4 md:p-8 lg:p-12 print:p-0 print:max-w-none">
               {renderContent()}
            </div>
          </main>
        </>
      )}

      {/* 3. LOGIN SCREEN */}
      {!isAuthLoading && (!session || !currentUser) && (
         <Login />
      )}
    </div>
  );
};

export default App;
