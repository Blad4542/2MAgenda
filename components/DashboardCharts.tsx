"use client";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface MonthlyRevenue { month: string; ingresos: number; }
interface TechAppointment { tecnico: string; citas: number; }
interface TaskStatus { name: string; value: number; }

interface Props {
  monthlyRevenue: MonthlyRevenue[];
  techAppointments: TechAppointment[];
  taskStatuses: TaskStatus[];
}

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#10b981"];

export default function DashboardCharts({ monthlyRevenue, techAppointments, taskStatuses }: Props) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Estadísticas</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Ingresos mensuales */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Ingresos mensuales (últimos 6 meses)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#07C3F8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#07C3F8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `₡${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`₡${Number(v).toLocaleString("es-CR")}`, "Ingresos"]} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
              <Area type="monotone" dataKey="ingresos" stroke="#07C3F8" strokeWidth={2} fill="url(#colorIngresos)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución cotizaciones */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Estado de cotizaciones</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={taskStatuses} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {taskStatuses.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Citas por técnico */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Citas este mes por técnico</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={techAppointments} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="tecnico" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
              <Bar dataKey="citas" fill="#07C3F8" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
