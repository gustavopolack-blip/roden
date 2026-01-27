
import React, { useState, useEffect } from 'react';
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
import { 
  MOCK_USER_ADMIN, MOCK_USER_RESTRICTED, MOCK_USER_MANAGER,
  MOCK_CLIENTS, MOCK_PROJECTS, MOCK_BUDGETS, MOCK_SUPPLIERS,
  MOCK_SUPPLIER_PAYMENTS, MOCK_TASKS, MOCK_USERS_LIST 
} from './constants';
import { BusinessData, Client, Project, Budget, Task, User, SupplierPayment, Report, Supplier } from './types';
import { supabase } from './services/supabaseClient';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  
  // App State - Initialized empty, populated by Supabase or Mocks
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  
  // Auth State (Mocked for demo purposes)
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USER_ADMIN);

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchData();
  }, []);

  const loadDemoData = () => {
      console.log("Loading Demo Data Set...");
      setClients(MOCK_CLIENTS);
      setProjects(MOCK_PROJECTS);
      setBudgets(MOCK_BUDGETS);
      setSuppliers(MOCK_SUPPLIERS);
      setSupplierPayments(MOCK_SUPPLIER_PAYMENTS);
      setTasks(MOCK_TASKS);
      setUsers(MOCK_USERS_LIST);
      // Create a mock report for visual check
      setReports([{
          id: 'rep_demo',
          projectId: MOCK_PROJECTS[0].id,
          generatedDate: new Date().toISOString(),
          observations: 'Informe generado automáticamente por el sistema demo.',
          projectNameSnapshot: MOCK_PROJECTS[0].title
      }]);
  };

  const fetchData = async () => {
      setIsLoading(true);
      try {
          // Parallel fetching for performance
          const [
              clientsRes, 
              projectsRes, 
              budgetsRes, 
              suppliersRes, 
              paymentsRes, 
              tasksRes, 
              usersRes, 
              reportsRes
          ] = await Promise.all([
              supabase.from('clients').select('*'),
              supabase.from('projects').select('*'),
              supabase.from('budgets').select('*'),
              supabase.from('suppliers').select('*'),
              supabase.from('supplier_payments').select('*'),
              supabase.from('tasks').select('*'),
              supabase.from('users').select('*'),
              supabase.from('reports').select('*')
          ]);

          // Check if we actually have data (or if Supabase is connected)
          const hasRealData = projectsRes.data && projectsRes.data.length > 0;

          if (hasRealData) {
              if (clientsRes.data) setClients(clientsRes.data);
              if (projectsRes.data) setProjects(projectsRes.data);
              if (budgetsRes.data) setBudgets(budgetsRes.data);
              if (suppliersRes.data) setSuppliers(suppliersRes.data);
              if (paymentsRes.data) setSupplierPayments(paymentsRes.data);
              if (tasksRes.data) setTasks(tasksRes.data);
              if (usersRes.data) setUsers(usersRes.data);
              if (reportsRes.data) setReports(reportsRes.data);
          } else {
              // If no data found (or placeholder Supabase), load Mocks for Demo Experience
              throw new Error("No remote data found, triggering demo mode.");
          }

      } catch (error) {
          console.warn("Running in Demo Mode (Local Data):", error);
          loadDemoData();
      } finally {
          setIsLoading(false);
      }
  };

  const toggleUserRole = () => {
    // Cycle: ADMIN -> USER -> WORKSHOP_MANAGER -> ADMIN
    if (currentUser.role === 'ADMIN') {
        setCurrentUser(MOCK_USER_RESTRICTED); // To User
        if (['dashboard', 'clients', 'budgets', 'staff', 'settings', 'suppliers'].includes(currentPage)) {
            setCurrentPage('projects');
        }
    } else if (currentUser.role === 'USER') {
        setCurrentUser(MOCK_USER_MANAGER); // To Workshop Manager
        if (['dashboard', 'clients', 'budgets', 'staff', 'settings'].includes(currentPage)) {
            setCurrentPage('projects');
        }
    } else {
        setCurrentUser(MOCK_USER_ADMIN); // Back to Admin
    }
  };

  // --- ASYNC HANDLERS (CRUD) ---

  const handleAddClient = async (newClient: Client) => {
    // Optimistic Update
    setClients(prev => [...prev, newClient]);
    const { error } = await supabase.from('clients').insert(newClient);
    if (error) console.error("Sync error:", error);
  };

  const handleAddProject = async (newProject: Project) => {
    setProjects(prev => [...prev, newProject]);
    const { error } = await supabase.from('projects').insert(newProject);
    if (error) console.error("Sync error:", error);
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    const { error } = await supabase.from('projects').update(updatedProject).eq('id', updatedProject.id);
    if (error) console.error("Sync error:", error);
  };

  const handleAddBudget = async (newBudget: Budget) => {
    setBudgets(prev => [...prev, newBudget]);
    const { error } = await supabase.from('budgets').insert(newBudget);
    if (error) console.error("Sync error:", error);
  };

  const handleAddSupplier = async (newSupplier: Supplier) => {
    setSuppliers(prev => [...prev, newSupplier]);
    const { error } = await supabase.from('suppliers').insert(newSupplier);
    if (error) console.error("Sync error:", error);
  };

  const handleAddSupplierPayment = async (newPayment: SupplierPayment) => {
    setSupplierPayments(prev => [...prev, newPayment]);
    const { error } = await supabase.from('supplier_payments').insert(newPayment);
    if (error) console.error("Sync error:", error);
  };

  const handleUpdateSupplierPayment = async (updatedPayment: SupplierPayment) => {
    setSupplierPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p));
    const { error } = await supabase.from('supplier_payments').update(updatedPayment).eq('id', updatedPayment.id);
    if (error) console.error("Sync error:", error);
  };

  const handleAddTask = async (newTask: Task) => {
    setTasks(prev => [...prev, newTask]);
    const { error } = await supabase.from('tasks').insert(newTask);
    if (error) console.error("Sync error:", error);
  };

  const handleAddUser = async (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
    const { error } = await supabase.from('users').insert(newUser);
    if (error) console.error("Sync error:", error);
  };

  const handleSaveReport = async (newReport: Report) => {
      setReports(prev => [newReport, ...prev]);
      const { error } = await supabase.from('reports').insert(newReport);
      if (error) console.error("Sync error:", error);
  };

  // Centralized Data Object
  const data: BusinessData = {
    clients,
    projects,
    budgets,
    suppliers,
    supplierPayments,
    tasks,
    user: currentUser
  };

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center text-gray-400">
                <Loader2 size={48} className="animate-spin mb-4 text-roden-black" />
                <p>Iniciando rødën OS...</p>
            </div>
        );
    }

    switch (currentPage) {
      case 'dashboard':
        return currentUser.role === 'ADMIN' ? <Dashboard data={data} /> : null;
      case 'projects':
        return (
          <Projects 
            projects={data.projects} 
            clients={data.clients}
            user={currentUser}
            onAddProject={handleAddProject} 
            onUpdateProject={handleUpdateProject}
          />
        );
      case 'clients':
        return currentUser.role === 'ADMIN' ? <Clients clients={data.clients} onAddClient={handleAddClient} /> : null;
      case 'tasks':
        return <Tasks tasks={data.tasks} projects={data.projects} users={users} onAddTask={handleAddTask} />;
      case 'ai':
        return <AIAssistant data={data} />;
      case 'reports':
          return ['ADMIN', 'WORKSHOP_MANAGER', 'USER'].includes(currentUser.role) ? (
            <Reports 
              projects={data.projects}
              clients={data.clients}
              tasks={data.tasks}
              reports={reports}
              user={currentUser}
              onSaveReport={handleSaveReport}
            />
          ) : null;
      case 'budgets':
        return currentUser.role === 'ADMIN' ? (
          <Budgets 
            budgets={data.budgets} 
            projects={data.projects} 
            supplierPayments={data.supplierPayments}
            onAddBudget={handleAddBudget} 
          />
        ) : null;
      case 'suppliers':
          return ['ADMIN', 'WORKSHOP_MANAGER'].includes(currentUser.role) ? (
              <SupplierPayments 
                payments={data.supplierPayments}
                suppliers={data.suppliers}
                projects={data.projects}
                user={currentUser}
                onAddPayment={handleAddSupplierPayment}
                onUpdatePayment={handleUpdateSupplierPayment}
                onAddSupplier={handleAddSupplier}
              />
          ) : null;
      case 'production':
        return <Production 
                projects={data.projects} 
                clients={data.clients} 
                user={currentUser}
                onUpdateProject={handleUpdateProject} 
                onAddProject={handleAddProject}
               />;
      case 'staff':
        return currentUser.role === 'ADMIN' ? <Staff users={users} onAddUser={handleAddUser} /> : null;
      case 'settings':
        return currentUser.role === 'ADMIN' ? <Settings onLoadDemoData={loadDemoData} /> : null;
      default:
        return currentUser.role === 'ADMIN' ? <Dashboard data={data} /> : <Projects projects={data.projects} clients={data.clients} user={currentUser} onAddProject={handleAddProject} onUpdateProject={handleUpdateProject}/>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-roden-black selection:bg-black selection:text-white">
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        user={currentUser}
        onToggleRole={toggleUserRole}
      />
      
      <main className="pl-64 print:pl-0">
        <div className="max-w-[1440px] mx-auto p-8 lg:p-12 print:p-0 print:max-w-none">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
