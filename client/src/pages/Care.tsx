import { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldAlert, Phone, Users, PhoneCall } from 'lucide-react';
import { Layout } from '@/components/Layout';

interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export default function Care() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('Parent');
  const [calling, setCalling] = useState<string | null>(null);

  const [alerts, setAlerts] = useState({
    highBpm: true,
    lowBpm: true,
    sendLocation: true
  });

  useEffect(() => {
    const saved = localStorage.getItem('heartguard_contacts');
    if (saved) setContacts(JSON.parse(saved));
  }, []);

  const saveContacts = (newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem('heartguard_contacts', JSON.stringify(newContacts));
  };

  const addContact = () => {
    if (!newName || !newPhone) return;
    const contact: Contact = {
      id: Date.now().toString(),
      name: newName,
      phone: newPhone,
      relation: newRelation
    };
    saveContacts([...contacts, contact]);
    setNewName('');
    setNewPhone('');
    setShowAdd(false);
  };

  const deleteContact = (id: string) => {
    saveContacts(contacts.filter(c => c.id !== id));
  };

  /** Directly initiates a phone call — no confirmation step */
  const callContact = (contact: Contact) => {
    setCalling(contact.id);
    // Using an <a> element trick forces the call intent immediately
    const a = document.createElement('a');
    a.href = `tel:${contact.phone}`;
    a.click();
    setTimeout(() => setCalling(null), 3000);
  };

  /** Emergency SOS — calls first contact or 112 immediately */
  const triggerSOS = () => {
    if (contacts.length > 0) {
      callContact(contacts[0]);
    } else {
      const a = document.createElement('a');
      a.href = 'tel:112';
      a.click();
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Circle of Care</h1>
          <p className="text-sm text-gray-400">Keep your family informed and safe.</p>
        </div>

        {/* SOS Button */}
        <button
          onClick={triggerSOS}
          className="w-full bg-red-600 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 text-sm uppercase tracking-wider shadow-lg shadow-red-200 active:scale-95 transition-transform"
        >
          <PhoneCall className="w-5 h-5" />
          {contacts.length > 0
            ? `🆘 Emergency — Call ${contacts[0].name}`
            : '🆘 Emergency — Call 112'}
        </button>
        {contacts.length > 0 && (
          <p className="text-[10px] text-gray-400 text-center -mt-6">
            Saying "Emergency" also triggers this call instantly
          </p>
        )}

        {/* Emergency Contacts */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> Emergency Contacts
            </h2>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showAdd && (
            <div className="bg-blue-50 p-4 rounded-2xl space-y-3 border border-blue-100">
               <input
                 placeholder="Full Name"
                 className="w-full p-3 rounded-xl border-none text-sm"
                 value={newName} onChange={e => setNewName(e.target.value)}
               />
               <input
                 placeholder="Phone Number (e.g. +91 98765 43210)"
                 className="w-full p-3 rounded-xl border-none text-sm"
                 value={newPhone} onChange={e => setNewPhone(e.target.value)}
                 type="tel"
               />
               <select
                 className="w-full p-3 rounded-xl border-none text-sm"
                 value={newRelation} onChange={e => setNewRelation(e.target.value)}
               >
                 <option>Parent</option>
                 <option>Spouse</option>
                 <option>Child</option>
                 <option>Friend</option>
                 <option>Doctor</option>
               </select>
               <button
                 onClick={addContact}
                 className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-xs uppercase"
               >
                 Save Contact
               </button>
            </div>
          )}

          <div className="space-y-3">
             {contacts.length === 0 && !showAdd && (
               <div className="text-center py-8 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                 <p className="text-xs text-gray-400">No emergency contacts added.</p>
                 <p className="text-[10px] text-gray-300 mt-1">Add a contact so HeartGuard can call them in an emergency.</p>
               </div>
             )}
             {contacts.map((contact, idx) => (
               <div key={contact.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase relative">
                     {contact.name.charAt(0)}
                     {idx === 0 && (
                       <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">1</span>
                     )}
                   </div>
                   <div>
                     <p className="text-sm font-bold text-gray-900">{contact.name}</p>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{contact.relation} • {contact.phone}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   {/* Direct call button */}
                   <button
                     onClick={() => callContact(contact)}
                     className={`p-2 rounded-full transition-colors ${calling === contact.id ? 'bg-green-100 text-green-600 animate-pulse' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                   >
                     <Phone className="w-4 h-4" />
                   </button>
                   <button onClick={() => deleteContact(contact.id)} className="p-2 text-red-400 hover:text-red-600">
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               </div>
             ))}
          </div>
        </section>

        {/* Alert Settings */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Alert Settings
          </h2>
          
          <div className="bg-white rounded-3xl border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-sm font-bold text-gray-900">High Vitals Alert</p>
                 <p className="text-[10px] text-gray-400 font-medium">Notify if BPM {'>'} 120</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" checked={alerts.highBpm} onChange={e => setAlerts({...alerts, highBpm: e.target.checked})} className="sr-only peer" />
                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
            </div>
            <div className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-sm font-bold text-gray-900">Low Vitals Alert</p>
                 <p className="text-[10px] text-gray-400 font-medium">Notify if BPM {'<'} 45</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" checked={alerts.lowBpm} onChange={e => setAlerts({...alerts, lowBpm: e.target.checked})} className="sr-only peer" />
                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
            </div>
            <div className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-sm font-bold text-gray-900">Share Location</p>
                 <p className="text-[10px] text-gray-400 font-medium">Include Google Maps link</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" checked={alerts.sendLocation} onChange={e => setAlerts({...alerts, sendLocation: e.target.checked})} className="sr-only peer" />
                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
