import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign, TrendingUp, BarChart2, FileText,
  CreditCard, ArrowRightLeft, Banknote, Building2
} from "lucide-react";

const reports = [
  {
    label: "Sales Report",
    desc: "How much you collected today, this week, or this month — broken down by Cash, M-Pesa, and other payments.",
    href: "/reports/sales",
    icon: DollarSign,
    color: "bg-green-100 text-green-700",
  },
  {
    label: "Products Report",
    desc: "Which products are selling the most, how many units went out, and how much money each product brought in.",
    href: "/reports/products",
    icon: TrendingUp,
    color: "bg-blue-100 text-blue-700",
  },
  {
    label: "Profit & Loss",
    desc: "What you collected, what you spent on stock, expenses you paid, and how much money you actually made.",
    href: "/profit-loss",
    icon: FileText,
    color: "bg-purple-100 text-purple-700",
  },
  {
    label: "Business Overview",
    desc: "A quick health check — top products, top customers, money owed to you, and stock alerts all in one place.",
    href: "/reports/business",
    icon: Building2,
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    label: "Debtors",
    desc: "Customers who owe you money. See exactly who owes how much and for how long.",
    href: "/debtors",
    icon: CreditCard,
    color: "bg-orange-100 text-orange-700",
  },
  {
    label: "Expenses",
    desc: "All the money you spent running your business — rent, salaries, utilities, and more.",
    href: "/expenses",
    icon: Banknote,
    color: "bg-red-100 text-red-700",
  },
  {
    label: "Cash Flow",
    desc: "Money coming in and going out of your business over time.",
    href: "/cashflow",
    icon: ArrowRightLeft,
    color: "bg-teal-100 text-teal-700",
  },
];

export default function ReportsHubPage() {
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-5 w-5 text-purple-600" />
            <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          </div>
          <p className="text-sm text-gray-500">Choose a report to see what's happening in your business.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {reports.map(r => (
            <Card
              key={r.href}
              className="border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:border-purple-200 transition-all"
              onClick={() => setLocation(r.href)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${r.color}`}>
                  <r.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{r.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
