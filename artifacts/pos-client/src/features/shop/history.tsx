import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, Search, Calendar } from "lucide-react";
import ExpandedSidebar from "@/components/pos/expanded-sidebar";

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ExpandedSidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
              <p className="text-gray-600">View all your sales transactions</p>
            </div>
            <Button variant="outline">
              <Search className="w-4 h-4 mr-2" />
              Search Transactions
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="w-5 h-5 mr-2" />
                Recent Transactions
              </CardTitle>
              <CardDescription>All sales and refund transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
                <p className="mb-4">Transaction history will appear here after your first sale</p>
                <Button variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Set Date Range
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}