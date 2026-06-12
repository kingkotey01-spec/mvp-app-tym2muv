import { supabase } from '../supabaseClient';

export interface SimulatedEmail {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  htmlBody: string;
  timestamp: string;
  read: boolean;
}

export const sendWelcomeComms = async (emailAddress: string, userName: string, role: string) => {
  try {
    // 1. In-app notification creation
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Welcome to tym2muv! 🔑',
          text: `Hey ${userName || 'friend'}, welcome! Your account is active. Explore verified listings and our Advance Skip features!`,
          link: `/profile/${user.id}?tab=inbox`,
          read: false
        });
      if (error) {
        console.error("Error creating welcome notification inside Supabase", error);
      }
    }

    // Dispatch a custom event to notify other components (like NotificationDropdown) that state changed
    window.dispatchEvent(new Event('tym2muv_notifications_updated'));

    // 2. Outbound simulated Welcome email
    const cachedEmails = localStorage.getItem('tym2muv_simulated_emails');
    let emailList: SimulatedEmail[] = cachedEmails ? JSON.parse(cachedEmails) : [];

    const absoluteLoginLink = `${window.location.origin}/signin`;

    // High fidelity email HTML matching user template and styled beautifully
    const htmlEmail = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: left;">
        
        <!-- Header / Logo -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed 0%, #d946ef 100%); border-radius: 16px; color: white; font-weight: 800; font-size: 24px; letter-spacing: -0.05em; box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.25);">
            tym2muv 🔑
          </div>
        </div>

        <!-- Content Card -->
        <div style="background-color: white; border-radius: 20px; padding: 36px; border: 1px solid #f1f5f9; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.02);">
          
          <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 20px; font-family: system-ui; letter-spacing: -0.025em; background: linear-gradient(to right, #7c3aed, #d946ef); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            you’re in. welcome to tym2muv 🔑
          </h2>

          <p style="font-size: 16px; color: #334155; margin-bottom: 24px;">
            hey <strong>${userName || 'friend'}</strong>, welcome to tym2muv!
          </p>

          <p style="font-size: 15px; color: #475569; margin-bottom: 24px; line-height: 1.7;">
            your account is active and the old-school real estate headaches are officially over.
          </p>

          <!-- Divider -->
          <div style="height: 1px; background-color: #f1f5f9; margin: 24px 0;"></div>

          <!-- Feature 1 -->
          <div style="display: flex; align-items: flex-start; margin-bottom: 18px;">
            <div style="background-color: #f5f3ff; color: #7c3aed; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; margin-right: 14px; flex-shrink: 0; border: 1px solid #e0e7ff;">
              ✓
            </div>
            <div>
              <h4 style="font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">100% verified listings</h4>
              <p style="font-size: 14px; color: #64748b; margin: 0;">No scams, ever. Every listing goes through a comprehensive system check.</p>
            </div>
          </div>

          <!-- Feature 2 -->
          <div style="display: flex; align-items: flex-start; margin-bottom: 24px;">
            <div style="background-color: #fdf2f8; color: #db2777; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; margin-right: 14px; flex-shrink: 0; border: 1px solid #fce7f3;">
              ⚡
            </div>
            <div>
              <h4 style="font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">The Advance Skip</h4>
              <p style="font-size: 14px; color: #64748b; margin: 0;">We pay upfront, you pay monthly. Break down your steep advance payments.</p>
            </div>
          </div>

          <!-- Divider -->
          <div style="height: 1px; background-color: #f1f5f9; margin: 24px 0;"></div>

          <p style="font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 28px; text-align: center;">
            your next chapter starts right now. let's find your space.
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${absoluteLoginLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white !important; text-decoration: none; font-size: 16px; font-weight: 700; padding: 16px 36px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3); transition: all 0.2s;">
              find my spot ➡️
            </a>
          </div>

          <!-- Account Specs list -->
          <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; font-size: 12px; color: #64748b; border: 1px solid #e2e8f0; margin-top: 24px;">
            <strong style="color: #475569; display: block; margin-bottom: 6px;">Secure Registration Details:</strong>
            • Registered Email: <span style="font-family: monospace; color: #334155; font-weight: 600;">${emailAddress}</span><br/>
            • Profile Handshake: <span style="color: #334155; font-weight: 600;">${role} Account</span><br/>
            • Host Domain: <span style="font-family: monospace; color: #7c3aed; font-weight: 600;">tym2muv.com</span><br/>
            • Portal Security: High-Grade Cloudflare Isolation Active
          </div>

        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8;">
          <p>© 2026 tym2muv Inc. Africa's Premier Real Estate Transaction Gateway.</p>
          <p>This is a simulated transactional secure handshake envelope sent automatically to new profiles.</p>
        </div>

      </div>
    `;

    const plainBody = `
Subject: you’re in. welcome to tym2muv 🔑

hey ${userName || 'friend'}, welcome to tym2muv!

your account is active and the old-school real estate headaches are officially over.

100% verified listings (no scams, ever)

The Advance Skip (we pay upfront, you pay monthly)

your next chapter starts right now. let's find your space.

[ find my spot ➡️ ]

----------------------------------------
SECURE PROFILE HANDSHAKE:
Registered Email: ${emailAddress}
Role Selected: ${role} Mode
Login Link: ${absoluteLoginLink}
----------------------------------------
    `;

    emailList.unshift({
      id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: 'welcome@tym2muv.com',
      recipient: emailAddress,
      subject: 'you’re in. welcome to tym2muv 🔑',
      body: plainBody.trim(),
      htmlBody: htmlEmail,
      timestamp: new Date().toISOString(),
      read: false
    });

    localStorage.setItem('tym2muv_simulated_emails', JSON.stringify(emailList));
    window.dispatchEvent(new Event('tym2muv_emails_updated'));
  } catch (error) {
    console.error('Error generating simulated communications:', error);
  }
};

export const getSimulatedEmails = (): SimulatedEmail[] => {
  try {
    const cached = localStorage.getItem('tym2muv_simulated_emails');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    return [];
  }
};

export const markEmailAsRead = (id: string) => {
  try {
    const emails = getSimulatedEmails();
    const updated = emails.map(email => email.id === id ? { ...email, read: true } : email);
    localStorage.setItem('tym2muv_simulated_emails', JSON.stringify(updated));
    window.dispatchEvent(new Event('tym2muv_emails_updated'));
  } catch (e) {
    console.error('Error marking email as read', e);
  }
};

export const clearAllSimulatedEmails = () => {
  try {
    localStorage.removeItem('tym2muv_simulated_emails');
    window.dispatchEvent(new Event('tym2muv_emails_updated'));
  } catch (e) {
    console.error('Error clearing emails', e);
  }
};
