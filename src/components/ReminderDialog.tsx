'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Calendar, Upload } from 'lucide-react'
import { ReminderInfo } from '@/types'

interface ReminderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder: ReminderInfo | null
  onUploadClick: () => void
}

export default function ReminderDialog({
  open,
  onOpenChange,
  reminder,
  onUploadClick
}: ReminderDialogProps) {
  if (!reminder) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            数据提醒
          </DialogTitle>
          <DialogDescription>
            请检查以下数据是否需要更新
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 周度数据提醒 */}
          <div className={`flex items-start gap-3 p-3 rounded-lg ${
            reminder.weekly.needed ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-green-50 dark:bg-green-950/30'
          }`}>
            {reminder.weekly.needed ? (
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">周度动量数据</p>
              <p className="text-xs text-muted-foreground mt-1">
                {reminder.weekly.message || '数据已更新'}
              </p>
            </div>
          </div>

          {/* 季度数据提醒 */}
          <div className={`flex items-start gap-3 p-3 rounded-lg ${
            reminder.quarterly.needed ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-green-50 dark:bg-green-950/30'
          }`}>
            {reminder.quarterly.needed ? (
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">季度全A数据</p>
              <p className="text-xs text-muted-foreground mt-1">
                {reminder.quarterly.message || '数据已更新'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            稍后提醒
          </Button>
          {(reminder.weekly.needed || reminder.quarterly.needed) && (
            <Button onClick={onUploadClick}>
              <Upload className="h-4 w-4 mr-2" />
              去上传
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
