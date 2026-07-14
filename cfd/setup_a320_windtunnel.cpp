#include "setup.hpp"

// Airbus A320 virtual wind tunnel — AirbusEngine3D cfd pipeline.
// Replaces FluidX3D src/setup.cpp (see cfd/run_a320.sh). Required extensions
// in defines.hpp: FP16S, VOLUME_FORCE, FORCE_FIELD, EQUILIBRIUM_BOUNDARIES,
// SUBGRID, GRAPHICS.
// Scenario: climb-out at 150 kn (77 m/s), 8 deg angle of attack, sea-level
// ISA air. Geometry is our parametric A320 GLB exported to stl/a320.stl,
// nose facing -y, z up (flow runs along +y).
void main_setup() {
	const uint3 lbm_N = resolution(float3(1.0f, 2.0f, 0.5f), 2000u); // box aspect ratio + VRAM budget in MB
	const float si_u = 77.0f;       // freestream velocity [m/s]
	const float si_length = 37.57f; // A320 overall length [m]
	const float si_S = 122.6f;      // wing reference area [m^2] for CL/CD
	const float si_nu = 1.48E-5f, si_rho = 1.225f;
	const float aoa = 8.0f;         // angle of attack [deg]
	const float lbm_u = 0.075f;
	const float lbm_length = 0.8f*(float)lbm_N.x;
	units.set_m_kg_s(lbm_length, lbm_u, 1.0f, si_length, si_u, si_rho);
	const ulong lbm_T = units.t(3.5f); // ~3.5 s of physical time
	print_info("Re(length) = "+to_string(units.si_Re(si_length, si_u, si_nu), 0u));
	LBM lbm(lbm_N, units.nu(si_nu));
	const float3 center = float3(lbm.center().x, 0.42f*(float)lbm_N.y, lbm.center().z);
	const float3x3 rotation = float3x3(float3(1, 0, 0), radians(-aoa)); // nose-up pitch
	lbm.voxelize_stl(get_exe_path()+"../stl/a320.stl", center, rotation, lbm_length, TYPE_S|TYPE_X);
	const uint Nx=lbm.get_Nx(), Ny=lbm.get_Ny(), Nz=lbm.get_Nz(); parallel_for(lbm.get_N(), [&](ulong n) { uint x=0u, y=0u, z=0u; lbm.coordinates(n, x, y, z);
		if(lbm.flags[n]!=TYPE_S) lbm.u.y[n] = lbm_u;
		if(x==0u||x==Nx-1u||y==0u||y==Ny-1u||z==0u||z==Nz-1u) lbm.flags[n] = TYPE_E; // inflow/outflow on all box faces
	});
	lbm.graphics.visualization_modes = VIS_FLAG_SURFACE|VIS_Q_CRITERION;
	lbm.run(0u, lbm_T);
	while(lbm.get_t()<=lbm_T) {
#if defined(GRAPHICS) && !defined(INTERACTIVE_GRAPHICS)
		if(lbm.graphics.next_frame(lbm_T, 200.0f/60.0f)) { // 200 frames per camera -> 6.7 s of 30 fps video
			// Apple's OpenCL driver leaks per offline render and segfaults the
			// process after ~700 write_frame calls — keep total renders (frames
			// x cameras) under ~600 per run; BMP keeps the CPU out of the way
			lbm.graphics.set_camera_free(float3(1.0f*(float)Nx, -0.4f*(float)Ny, 2.0f*(float)Nz), -33.0f, 42.0f, 68.0f);
			lbm.graphics.write_frame_bmp(get_exe_path()+"export/hero/");
			lbm.graphics.set_camera_centered(0.0f, 0.0f, 25.0f, 1.648722f);
			lbm.graphics.write_frame_bmp(get_exe_path()+"export/side/");
			lbm.graphics.set_camera_centered(0.0f, 90.0f, 25.0f, 1.648722f);
			lbm.graphics.write_frame_bmp(get_exe_path()+"export/top/");
		}
#endif // GRAPHICS && !INTERACTIVE_GRAPHICS
		if(lbm.get_t()%1000u==0u) { // indicative only: voxel-resolution walls, no wall model
			const float3 lbm_force = lbm.object_force(TYPE_S|TYPE_X);
			const float si_drag = units.si_F(lbm_force.y), si_lift = units.si_F(lbm_force.z);
			const float qS = 0.5f*si_rho*sq(si_u)*si_S;
			print_info("t = "+to_string(lbm.get_t())+", lift = "+to_string(si_lift/1000.0f, 1u)+" kN (CL = "+to_string(si_lift/qS, 3u)+"), drag = "+to_string(si_drag/1000.0f, 1u)+" kN (CD = "+to_string(si_drag/qS, 3u)+")");
		}
		lbm.run(1u, lbm_T);
	}
	lbm.write_status();
}
