"use client"
import Link from 'next/link'
import { Calendar, MapPin, Users, Plus, Ticket, RotateCw, CheckCircle, Clock, XCircle, Pencil, Hourglass } from 'lucide-react'
import EventImage from '@/components/EventImage'
import DeleteEventButton from '@/components/DeleteEventButton'
import { useState, useEffect } from 'react'
import { formatDateTime } from '@/lib/utils'

export default function EventsClient({ events: initialEvents }: { events: any[] }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalImage, setModalImage] = useState<string|null>(null)
  const [events, setEvents] = useState(initialEvents)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null)
  const [sortBy, setSortBy] = useState('date')

  // Polling: auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEvents()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Manual refresh
  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
        setLastUpdated(new Date())
      }
    } finally {
      setLoading(false)
    }
  }

  let filteredEvents = events.filter((event: any) => {
    const matchesSearch = event.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = !filterType || (event.type && event.type.toLowerCase() === filterType.toLowerCase())
    // Status logic
    let matchesStatus = true
    const now = new Date()
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)
    const status = event.status || ''
    if (filterStatus === 'Draft') {
      matchesStatus = status === 'Draft'
    } else if (filterStatus === 'Published') {
      matchesStatus = status === 'Published'
    } else if (filterStatus === 'Ongoing') {
      matchesStatus = status === 'Published' && start <= now && end >= now
    } else if (filterStatus === 'Completed') {
      matchesStatus = status === 'Published' && end < now
    } else if (filterStatus === 'Cancelled') {
      matchesStatus = status === 'Cancelled'
    }
    return matchesSearch && matchesType && matchesStatus
  })

  // Sorting logic
  filteredEvents = [...filteredEvents].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name)
    } else if (sortBy === 'registrations') {
      return (b.verified_tickets || 0) - (a.verified_tickets || 0)
    } else if (sortBy === 'quota') {
      return (b.quota || 0) - (a.quota || 0)
    }
    return 0
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title + Create Event Button + Refresh */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 sm:mb-0">Events</h2>
            <button
              onClick={fetchEvents}
              className={`inline-flex items-center justify-center rounded-full bg-white border border-gray-200 shadow hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 h-10 w-10 ${loading ? 'opacity-60 cursor-wait' : ''}`}
              aria-label="Refresh events"
              disabled={loading}
            >
              <RotateCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''} text-blue-600`} />
            </button>
            {lastUpdated && (
              <span className="text-xs text-gray-400 ml-2 hidden sm:inline">Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          <Link href="/dashboard/events/create"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold text-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400">
            <span className="text-2xl font-bold">+</span>
            <span>Create Event</span>
          </Link>
        </div>

        {/* Search, Filter, and Sort */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center">
          <input type="text" placeholder="Search events..." className="w-full sm:w-1/2 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="Seminar">Seminar</option>
            <option value="Workshop">Workshop</option>
            <option value="Conference">Conference</option>
            <option value="Training">Training</option>
            <option value="Webinar">Webinar</option>
            <option value="Other">Other</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="registrations">Sort by Registrations</option>
            <option value="quota">Sort by Quota</option>
          </select>
        </div>

        {/* Events Grid */}
        {filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredEvents.map((event: any) => {
              // Gunakan quota jika ada, fallback ke total_tickets
              const quota = event.quota || event.total_tickets || 0
              const verified = event.verified_tickets || 0
              const registrationRate = quota > 0 ? Math.round((verified / quota) * 100) : 0
              const now = new Date()
              const start = new Date(event.start_time)
              const end = new Date(event.end_time)
              let statusBadge = null
              let cardClass = ''
              let statusTooltip = ''
              const status = event.status || ''
              if (status === 'Draft') {
                statusTooltip = 'Draft: Event belum dipublikasikan'
                statusBadge = (
                  <span className="relative group inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-gray-200 text-gray-700 shadow mt-2 animate-fade-in cursor-default">
                    <Pencil className="h-4 w-4 text-gray-500" /> Draft
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 hidden group-hover:flex px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg whitespace-nowrap transition-all duration-200 opacity-90 pointer-events-none">
                      {statusTooltip}
                    </span>
                  </span>
                )
                cardClass = 'opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300'
              } else if (status === 'Cancelled') {
                statusTooltip = 'Cancelled: Event dibatalkan'
                statusBadge = (
                  <span className="relative group inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-red-200 text-red-700 shadow mt-2 animate-fade-in cursor-default">
                    <XCircle className="h-4 w-4 text-red-500" /> Cancelled
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 hidden group-hover:flex px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg whitespace-nowrap transition-all duration-200 opacity-90 pointer-events-none">
                      {statusTooltip}
                    </span>
                  </span>
                )
                cardClass = 'opacity-40 grayscale line-through hover:opacity-80 hover:grayscale-0 transition-all duration-300'
              } else if (status === 'Published' && start > now) {
                statusTooltip = 'Upcoming: Event akan datang'
                statusBadge = (
                  <span className="relative group inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-blue-200 text-blue-700 shadow mt-2 animate-fade-in cursor-default">
                    <Hourglass className="h-4 w-4 text-blue-500 animate-pulse" /> Upcoming
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 hidden group-hover:flex px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg whitespace-nowrap transition-all duration-200 opacity-90 pointer-events-none">
                      {statusTooltip}
                    </span>
                  </span>
                )
                cardClass = 'hover:shadow-xl transition-all duration-300'
              } else if (start <= now && end >= now) {
                statusTooltip = 'Ongoing: Event sedang berlangsung'
                statusBadge = (
                  <span className="relative group inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-green-200 text-green-700 shadow mt-2 animate-fade-in cursor-default">
                    <Clock className="h-4 w-4 text-green-500 animate-pulse" /> Ongoing
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 hidden group-hover:flex px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg whitespace-nowrap transition-all duration-200 opacity-90 pointer-events-none">
                      {statusTooltip}
                    </span>
                  </span>
                )
                cardClass = 'hover:shadow-xl transition-all duration-300'
              } else if (end < now) {
                statusTooltip = 'Complete: Event telah selesai'
                statusBadge = (
                  <span className="relative group inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-gray-300 text-gray-700 shadow mt-2 animate-fade-in cursor-default">
                    <CheckCircle className="h-4 w-4 text-gray-500" /> Complete
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 hidden group-hover:flex px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg whitespace-nowrap transition-all duration-200 opacity-90 pointer-events-none">
                      {statusTooltip}
                    </span>
                  </span>
                )
                cardClass = 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300'
              }
              return (
                <div key={event.id} className={`bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden hover:shadow-2xl transition-all ${cardClass}`}>
                  {/* Ticket Design Image + Badges */}
                  <div className="relative w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {event.ticket_design ? (
                      <img
                        src={event.ticket_design.startsWith('/') ? event.ticket_design : `/uploads/${event.ticket_design}`}
                        alt="Ticket Design"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg font-semibold bg-gradient-to-br from-blue-50 to-purple-50">No Ticket Design</div>
                    )}
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                      {/* Type badge */}
                      <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full shadow bg-white/80 text-purple-700 border border-purple-200`}>{event.type}</span>
                      {/* Status badge (Draft/Cancelled/Upcoming/Ongoing/Complete) */}
                      {statusBadge}
                    </div>
                  </div>
                  {/* Event Info */}
                  <div className="flex-1 flex flex-col p-5">
                    <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">{event.name}</h3>
                    <p className="text-gray-500 text-sm mb-3 truncate">{event.description || '-'}</p>
                    <div className="flex items-center text-sm text-gray-500 mb-1 gap-2">
                      <Calendar className="h-4 w-4 text-blue-400" /> {formatDateTime(event.start_time)}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mb-1 gap-2">
                      <MapPin className="h-4 w-4 text-purple-400" /> {event.location}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mb-1 gap-2">
                      <Users className="h-4 w-4 text-green-400" /> {verified} / {quota} registered
                    </div>
                    <div className="flex items-center justify-between mt-2 mb-1">
                      <span className="text-xs text-gray-400">Registration Rate</span>
                      <span className="text-xs text-gray-500 font-semibold">{registrationRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full mb-2">
                      <div className="h-2 bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${registrationRate}%` }} />
                    </div>
                    {quota === 0 && (
                      <div className="text-xs text-red-500 mt-1">Quota belum diatur untuk event ini</div>
                    )}
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mt-auto pt-4">
                      <button
                        className="flex items-center gap-1 px-4 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-sm shadow transition-colors focus:outline-none focus:ring-2 focus:ring-purple-300"
                        onClick={() => setModalImage(event.ticket_design ? (event.ticket_design.startsWith('/') ? event.ticket_design : `/uploads/${event.ticket_design}`) : null)}
                        type="button"
                        aria-label="View Ticket Design"
                      >
                        <Ticket className="h-4 w-4" /> Tickets
                      </button>
                      <Link
                        href={`/dashboard/events/${event.id}`}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                        title="Preview Event"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M2.05 12C3.81 7.61 7.92 4.5 12 4.5c4.08 0 8.19 3.11 9.95 7.5-1.76 4.39-5.87 7.5-9.95 7.5-4.08 0-8.19-3.11-9.95-7.5z" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
                        <span>Detail</span>
                      </Link>
                      <Link href={`/dashboard/events/${event.id}/edit`} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-semibold text-sm shadow transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-4 1a1 1 0 01-1.263-1.263l1-4a4 4 0 01.828-1.414z" /></svg>
                        Edit
                      </Link>
                      <DeleteEventButton eventId={event.id} eventName={event.name} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No events yet</h3>
            <p className="text-gray-600">Create your first event to get started</p>
          </div>
        )}

        {/* Modal for Ticket Design */}
        {modalImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all animate-fade-in">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-8 flex flex-col items-center animate-fade-in-up">
              <button
                className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 rounded-full p-2 text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => setModalImage(null)}
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="relative w-full max-w-2xl aspect-[2/1] rounded-2xl overflow-hidden bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                {/* Ticket Design */}
                <img src={modalImage} alt="Ticket Design" className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
                {/* QR Code Overlay */}
                <div className="absolute top-6 right-8 flex flex-col items-center z-20">
                  <span className="text-xs font-mono text-gray-900 bg-white/80 px-2 py-1 rounded-t-lg tracking-widest mb-1">QR CODE</span>
                  {(() => {
                    const event = events.find(e => (e.ticket_design && (e.ticket_design === modalImage || `/uploads/${e.ticket_design}` === modalImage)))
                    if (event && event.qr_code_url) {
                      return <img src={event.qr_code_url} alt="QR Code" className="w-20 h-20 rounded-lg border-2 border-white shadow" />
                    } else {
                      return <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-mono border-2 border-white">No QR</div>
                    }
                  })()}
                </div>
                {/* Ticket Info Overlay (optional, bisa tambahkan info lain di sini) */}
              </div>
              <span className="text-gray-700 text-sm mt-4">Generated Ticket Preview</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 